import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureCaptureArtifactDirectory,
  formatCaptureDiagnostic,
  openCaptureBrowser,
  readCanvasCapture,
  readPageDiagnostic,
  summarizeRgbaPixels,
  waitForCaptureReady,
  writePngDataUrl,
} from "./capture-runtime.mjs";
import { openCaptureServerSession } from "./capture-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const artifactDirectoryPromise = ensureCaptureArtifactDirectory();
const defaultCaptureWidth = readCaptureInteger("PLASIUS_CAPTURE_WIDTH", 1280, 320, 4096);
const defaultCaptureHeight = readCaptureInteger("PLASIUS_CAPTURE_HEIGHT", 720, 180, 2304);
const defaultCaptureFrames = readCaptureInteger("PLASIUS_CAPTURE_FRAMES", 1, 1, 8);
const defaultCaptureMaxDepth = readCaptureInteger("PLASIUS_CAPTURE_MAX_DEPTH", 8, 1, 12);
const defaultCaptureSamplesPerPixel = readCaptureInteger("PLASIUS_CAPTURE_SPP", 1, 1, 256);
const defaultCaptureFrameIndex = readCaptureInteger("PLASIUS_CAPTURE_FRAME_INDEX", 777, 0, 1_000_000);
const minimumScreenshotBytes = readCaptureInteger("PLASIUS_CAPTURE_MIN_BYTES", 16_384, 0, 16_777_216);
const captureProbeReadback = process.env.PLASIUS_CAPTURE_PROBE !== "0";
const defaultDeferredPathResolve = process.env.PLASIUS_CAPTURE_DEFERRED !== "0";
const defaultCaptureDenoise = process.env.PLASIUS_CAPTURE_DENOISE !== "0";
const defaultCaptureMotion = process.env.PLASIUS_CAPTURE_MOTION === "1";
const defaultCaptureShowSources = process.env.PLASIUS_CAPTURE_SHOW_SOURCES === "1";
const captureLabel = sanitizeCaptureLabel(
  process.env.PLASIUS_CAPTURE_LABEL ?? (defaultDeferredPathResolve ? "deferred" : "legacy")
);
const allPresets = [
  "grass-field-dawn",
  "grass-field-midday",
  "grass-field-dusk",
  "grass-field-night",
  "forest-dawn",
  "forest-midday",
  "forest-dusk",
  "forest-night",
  "warehouse-dawn",
  "warehouse-midday",
  "warehouse-dusk",
  "warehouse-night",
  "cavern-dawn",
  "cavern-midday",
  "cavern-dusk",
  "cavern-night",
];
const presets = readCapturePresets(process.env.PLASIUS_CAPTURE_PRESETS, allPresets);

export function computeCaptureReadyTimeoutMs(options = {}) {
  const width = Math.max(1, Number(options.width ?? 1280));
  const height = Math.max(1, Number(options.height ?? 720));
  const frames = Math.max(1, Number(options.frames ?? 1));
  const maxDepth = Math.max(1, Number(options.maxDepth ?? 3));
  const samplesPerPixel = Math.max(1, Number(options.samplesPerPixel ?? 8));
  const tileEstimate = Math.max(1, Math.ceil(width / 128) * Math.ceil(height / 128));
  const perSamplePassEstimate = maxDepth + 2;
  const workEstimate = frames * samplesPerPixel * perSamplePassEstimate * tileEstimate;
  return Math.min(900_000, 60_000 + workEstimate * 30);
}

function readCaptureInteger(name, fallback, minimum, maximum) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function sanitizeCaptureLabel(value) {
  const label = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return label || "capture";
}

function readCapturePresets(value, fallback) {
  if (!value) {
    return fallback;
  }
  const selected = String(value)
    .split(",")
    .map((preset) => preset.trim())
    .filter(Boolean);
  for (const preset of selected) {
    if (!fallback.includes(preset)) {
      throw new Error(`Unknown Eames environment preset '${preset}'.`);
    }
  }
  return selected;
}

async function capturePreset(page, baseUrl, preset, geometry) {
  const artifactDirectory = await artifactDirectoryPromise;
  const url = new URL("/gpu-lighting/demo/eames-environments/index.html", baseUrl);
  url.searchParams.set("preset", preset);
  url.searchParams.set("geometry", geometry);
  url.searchParams.set("width", String(defaultCaptureWidth));
  url.searchParams.set("height", String(defaultCaptureHeight));
  url.searchParams.set("frames", String(defaultCaptureFrames));
  url.searchParams.set("maxDepth", String(defaultCaptureMaxDepth));
  url.searchParams.set("samplesPerPixel", String(defaultCaptureSamplesPerPixel));
  url.searchParams.set("denoise", defaultCaptureDenoise ? "1" : "0");
  url.searchParams.set("motion", defaultCaptureMotion ? "1" : "0");
  url.searchParams.set("probe", captureProbeReadback ? "1" : "0");
  url.searchParams.set("deferredPathResolve", defaultDeferredPathResolve ? "1" : "0");
  url.searchParams.set("frameIndex", String(defaultCaptureFrameIndex));
  url.searchParams.set("showSources", defaultCaptureShowSources ? "1" : "0");

  const readyTimeoutMs = computeCaptureReadyTimeoutMs({
    width: defaultCaptureWidth,
    height: defaultCaptureHeight,
    frames: defaultCaptureFrames,
    maxDepth: defaultCaptureMaxDepth,
    samplesPerPixel: defaultCaptureSamplesPerPixel,
  });

  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForCaptureReady(page, preset, readyTimeoutMs);
  const result = await page.evaluate(() => window.__plasiusCaptureResult ?? window.__plasiusCaptureError);
  if (!result || result.status !== "ok") {
    throw new Error(formatCaptureDiagnostic(preset, await readPageDiagnostic(page)));
  }
  if (result.geometry !== "mesh") {
    throw new Error(`${preset} captured ${result.geometry} geometry; Eames validation must use mesh triangles.`);
  }
  if (result.maxDepth !== defaultCaptureMaxDepth) {
    throw new Error(`${preset} rendered maxDepth=${result.maxDepth}; expected ${defaultCaptureMaxDepth}.`);
  }
  if (result.samplesPerPixel !== defaultCaptureSamplesPerPixel) {
    throw new Error(
      `${preset} rendered samplesPerPixel=${result.samplesPerPixel}; expected ${defaultCaptureSamplesPerPixel}.`
    );
  }
  if (result.frames !== defaultCaptureFrames) {
    throw new Error(`${preset} rendered frames=${result.frames}; expected ${defaultCaptureFrames}.`);
  }
  if (result.denoise !== defaultCaptureDenoise) {
    throw new Error(`${preset} rendered denoise=${result.denoise}; expected ${defaultCaptureDenoise}.`);
  }
  if (result.motion !== defaultCaptureMotion) {
    throw new Error(`${preset} rendered motion=${result.motion}; expected ${defaultCaptureMotion}.`);
  }
  if (result.meshCount <= 0 || result.renderer.triangleCount <= 0) {
    throw new Error(
      `${preset} did not render triangle mesh geometry: ${result.meshCount} meshes, ${result.renderer.triangleCount} renderer triangles.`
    );
  }
  if (
    result.probeReadback &&
    (result.probeSummary.nonZeroSamples <= 0 || !Number.isFinite(result.probeSummary.averageLuminance))
  ) {
    throw new Error(`${preset} rendered a blank or invalid output probe.`);
  }

  const canvasCapture = await readCanvasCapture(page);
  if (!canvasCapture?.dataUrl) {
    throw new Error(`${preset} did not expose a readable render canvas.`);
  }
  const canvasStats = summarizeRgbaPixels(canvasCapture.rgbaBytes);
  const screenshotPath = path.join(artifactDirectory, `eames-${preset}-${geometry}-${captureLabel}.png`);
  const screenshotBytes = await writePngDataUrl(screenshotPath, canvasCapture.dataUrl);
  if (screenshotBytes < minimumScreenshotBytes) {
    throw new Error(`${preset} screenshot is unexpectedly small: ${screenshotBytes} bytes.`);
  }
  const resultPath = path.join(artifactDirectory, `eames-${preset}-${geometry}-${captureLabel}.json`);
  await fs.writeFile(
    resultPath,
    `${JSON.stringify({ ...result, canvasStats }, null, 2)}\n`,
    "utf8"
  );
  return {
    ...result,
    canvasStats,
    screenshot: screenshotPath,
    screenshotBytes,
    screenshotRelative: path.relative(repoRoot, screenshotPath),
    resultFile: resultPath,
    resultRelative: path.relative(repoRoot, resultPath),
  };
}

async function captureMatrix(geometry) {
  const serverSession = await openCaptureServerSession();

  let browserSession;
  try {
    const baseUrl = serverSession.baseUrl;
    browserSession = await openCaptureBrowser();
    const page = await browserSession.context.newPage({
      viewport: { width: defaultCaptureWidth, height: defaultCaptureHeight },
      deviceScaleFactor: 1,
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        const source = location.url ? ` (${location.url}:${location.lineNumber})` : "";
        console.error(`[browser] ${message.text()}${source}`);
      }
    });
    page.on("response", (response) => {
      if (response.ok()) {
        return;
      }
      const responseUrl = new URL(response.url());
      if (responseUrl.pathname === "/favicon.ico") {
        return;
      }
      console.error(`[browser] ${response.status()} ${response.statusText()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      console.error(`[browser] request failed ${request.url()}: ${request.failure()?.errorText ?? "unknown error"}`);
    });

    const results = [];
    for (const preset of presets) {
      console.log(`capturing ${preset} (${geometry})`);
      results.push(await capturePreset(page, baseUrl, preset, geometry));
    }
    return {
      geometry,
      baseUrl: serverSession.baseUrl,
      results,
    };
  } finally {
    await browserSession?.close();
    await serverSession.close();
  }
}

async function main() {
  const artifactDirectory = await artifactDirectoryPromise;
  const manifest = await captureMatrix("mesh");

  const manifestPath = path.join(artifactDirectory, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const summaryPath = path.join(artifactDirectory, "summary.md");
  await fs.writeFile(
    summaryPath,
    [
      `# Eames Environment Lighting Screenshots`,
      ``,
      `Geometry: ${manifest.geometry}`,
      `Resolution: ${defaultCaptureWidth}x${defaultCaptureHeight}`,
      `Frames: ${defaultCaptureFrames}`,
      `Max depth: ${defaultCaptureMaxDepth}`,
      `SPP: ${defaultCaptureSamplesPerPixel}`,
      `Denoise: ${defaultCaptureDenoise ? "on" : "off"}`,
      `Deferred: ${defaultDeferredPathResolve ? "on" : "off"}`,
      `Motion: ${defaultCaptureMotion ? "on" : "off"}`,
      `Frame seed index: ${defaultCaptureFrameIndex}`,
      ``,
      ...manifest.results.map((result) => {
        const probe = result.probeSummary;
        const parallelism = result.renderer.gpuParallelism;
        const probeText = result.probeReadback
          ? `${probe.nonZeroSamples}/${probe.sampledPixels} lit probe samples, avg luminance ${probe.averageLuminance.toFixed(4)}`
          : "probe readback disabled";
        const canvasText = `${result.canvasStats.exactBlackPixels} black, ` +
          `${result.canvasStats.nearBlackPixels8} <=8, ` +
          `${result.canvasStats.nearBlackPixels16} <=16, avg canvas luminance ` +
          `${result.canvasStats.averageLuminance.toFixed(4)}`;
        const parallelismText = parallelism
          ? `${parallelism.directWorkgroups} direct workgroups, ${parallelism.indirectDispatches} indirect dispatches, multi-workgroup ${parallelism.exposesMultiWorkgroupParallelism ? "yes" : "no"}`
          : "parallelism unavailable";
        return `- ${result.preset}: ${result.screenshotRelative}, ${result.screenshotBytes} bytes, ${probeText}, ${canvasText}, ${parallelismText}`;
      }),
      ``,
    ].join("\n"),
    "utf8"
  );
  console.log(`wrote ${manifestPath}`);
  console.log(`wrote ${summaryPath}`);
}

if (!globalThis.__PLASIUS_EAMES_CAPTURE_MODULE_ONLY__) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
