import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  ensureCaptureArtifactDirectory,
  formatCaptureDiagnostic,
  openCaptureBrowser,
  readCanvasCapture,
  resolveCaptureWorkspaceRoot,
  readPageDiagnostic,
  summarizeRgbaPixels,
  waitForCaptureReady,
  writePngDataUrl,
} from "./capture-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const workspaceRoot = resolveCaptureWorkspaceRoot();
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

async function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start = 8765) {
  for (let port = start; port < start + 100; port += 1) {
    if (await portIsFree(port)) {
      return port;
    }
  }
  throw new Error("Unable to find a free local HTTP port for screenshot capture.");
}

async function canReuseStaticServer(port) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/gpu-lighting/demo/eames-environments/index.html`
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function findServerPort(start = 8765) {
  for (let port = start; port < start + 100; port += 1) {
    if (await canReuseStaticServer(port)) {
      return { port, reuse: true };
    }
    if (await portIsFree(port)) {
      return { port, reuse: false };
    }
  }
  throw new Error("Unable to find or start a local HTTP port for screenshot capture.");
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Static server exited early with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for static server at ${url}.`);
}

function startStaticServer(port) {
  const server = spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", workspaceRoot],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  return server;
}

async function stopStaticServer(server) {
  if (!server) {
    return;
  }
  if (server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2500);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
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

  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForCaptureReady(page, preset, geometry === "mesh" ? 180_000 : 90_000);
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
  const { port, reuse } = await findServerPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = reuse ? null : startStaticServer(port);
  await waitForServer(
    `${baseUrl}/gpu-lighting/demo/eames-environments/index.html`,
    server ?? { exitCode: null }
  );

  let browserSession;
  try {
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
      baseUrl,
      results,
    };
  } finally {
    await browserSession?.close();
    await stopStaticServer(server);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
