import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getValidationSceneDefinition, listValidationSceneDefinitions } from "../../demo/eames-environments/validation-scenes.js";
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
const defaultCaptureMaxDepth = readCaptureInteger("PLASIUS_CAPTURE_MAX_DEPTH", 8, 1, 32);
const defaultCaptureSamplesPerPixel = readCaptureInteger("PLASIUS_CAPTURE_SPP", 1, 1, 256);
const defaultCaptureFrameIndex = readCaptureInteger("PLASIUS_CAPTURE_FRAME_INDEX", 777, 0, 1_000_000);
const minimumScreenshotBytes = readCaptureInteger("PLASIUS_CAPTURE_MIN_BYTES", 16_384, 0, 16_777_216);
const captureProbeReadback = process.env.PLASIUS_CAPTURE_PROBE !== "0";
const defaultDeferredPathResolve = process.env.PLASIUS_CAPTURE_DEFERRED !== "0";
const defaultCaptureDenoise = process.env.PLASIUS_CAPTURE_DENOISE !== "0";
const defaultCaptureMotion = process.env.PLASIUS_CAPTURE_MOTION === "1";
const defaultCaptureShowSources = process.env.PLASIUS_CAPTURE_SHOW_SOURCES === "1";
const defaultMatrixMode = readCaptureMatrixMode(process.env.PLASIUS_CAPTURE_MATRIX_MODE);
const defaultCameraPresets = readCaptureCameraPresets(process.env.PLASIUS_CAPTURE_CAMERA_PRESETS);
const defaultSamplesPerPixelMatrix = readCaptureIntegerList(
  process.env.PLASIUS_CAPTURE_SPP_MATRIX,
  defaultMatrixMode === "full" ? [1, 4, 8, 32, 128] : [defaultCaptureSamplesPerPixel],
  1,
  256
);
const defaultDenoiseMatrix = readCaptureBooleanList(
  process.env.PLASIUS_CAPTURE_DENOISE_MATRIX,
  defaultMatrixMode === "full" ? [true, false] : [defaultCaptureDenoise]
);
const captureLabel = sanitizeCaptureLabel(
  process.env.PLASIUS_CAPTURE_LABEL ?? (defaultDeferredPathResolve ? "deferred" : "legacy")
);
const eamesValidationScene = getValidationSceneDefinition("eames");
const syntheticValidationScenes = listValidationSceneDefinitions().filter((scene) => scene.family === "synthetic");
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
const eamesPresets = readCapturePresets(process.env.PLASIUS_CAPTURE_PRESETS, allPresets);
export const MAX_CAPTURE_READY_TIMEOUT_MS = 3_600_000;

export function computeCaptureReadyTimeoutMs(options = {}) {
  const width = Math.max(1, Number(options.width ?? 1280));
  const height = Math.max(1, Number(options.height ?? 720));
  const frames = Math.max(1, Number(options.frames ?? 1));
  const maxDepth = Math.max(1, Number(options.maxDepth ?? 3));
  const samplesPerPixel = Math.max(1, Number(options.samplesPerPixel ?? 8));
  const tileEstimate = Math.max(1, Math.ceil(width / 128) * Math.ceil(height / 128));
  const perSamplePassEstimate = maxDepth + 2;
  const workEstimate = frames * samplesPerPixel * perSamplePassEstimate * tileEstimate;
  return Math.min(MAX_CAPTURE_READY_TIMEOUT_MS, 60_000 + workEstimate * 30);
}

function readCaptureMatrixMode(value) {
  const selected = String(value ?? "quick").trim().toLowerCase();
  if (!selected) {
    return "quick";
  }
  if (selected !== "quick" && selected !== "full") {
    throw new Error("PLASIUS_CAPTURE_MATRIX_MODE must be 'quick' or 'full'.");
  }
  return selected;
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

function readCaptureIntegerList(value, fallback, minimum, maximum) {
  const raw = String(value ?? "").trim();
  const values = raw
    ? raw
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter(Number.isFinite)
        .map((entry) => Math.max(minimum, Math.min(maximum, Math.round(entry))))
    : fallback;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Capture integer matrix must contain at least one numeric value.");
  }
  return [...new Set(values)];
}

function readCaptureBooleanList(value, fallback) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  const values = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (["1", "true", "on", "yes"].includes(entry)) {
        return true;
      }
      if (["0", "false", "off", "no"].includes(entry)) {
        return false;
      }
      throw new Error(`Unsupported boolean matrix value '${entry}'.`);
    });
  return [...new Set(values)];
}

function readCaptureCameraPresets(value) {
  const fallback = defaultMatrixMode === "full" ? ["reference", "wide"] : ["reference"];
  const selected = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const values = selected.length > 0 ? selected : fallback;
  for (const cameraPreset of values) {
    if (!["reference", "wide"].includes(cameraPreset)) {
      throw new Error(`Unsupported capture camera preset '${cameraPreset}'.`);
    }
  }
  return [...new Set(values)];
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

function buildScenarioId({
  validationSceneId,
  preset,
  geometry,
  cameraPreset,
  samplesPerPixel,
  denoise,
}) {
  return [
    validationSceneId,
    ...(preset ? [preset] : []),
    geometry,
    cameraPreset,
    `${samplesPerPixel}spp`,
    denoise ? "denoise-on" : "denoise-off",
    captureLabel,
  ].join("-");
}

function buildScenarioReproCommand(scenario) {
  const environment = [
    `PLASIUS_CAPTURE_CAMERA_PRESETS=${scenario.cameraPreset}`,
    `PLASIUS_CAPTURE_SPP_MATRIX=${scenario.samplesPerPixel}`,
    `PLASIUS_CAPTURE_DENOISE_MATRIX=${scenario.denoise ? 1 : 0}`,
    `PLASIUS_CAPTURE_MATRIX_MODE=quick`,
    `PLASIUS_CAPTURE_LABEL=${captureLabel}`,
  ];
  if (scenario.validationSceneId === "eames" && scenario.preset) {
    environment.unshift(`PLASIUS_CAPTURE_PRESETS=${scenario.preset}`);
  } else {
    environment.unshift(`PLASIUS_CAPTURE_VALIDATION_SCENE=${scenario.validationSceneId}`);
  }
  if (defaultCaptureFrames !== 1) {
    environment.push(`PLASIUS_CAPTURE_FRAMES=${defaultCaptureFrames}`);
  }
  if (defaultCaptureMaxDepth !== 8) {
    environment.push(`PLASIUS_CAPTURE_MAX_DEPTH=${defaultCaptureMaxDepth}`);
  }
  return `${environment.join(" ")} node scripts/eames-environments/capture.mjs`;
}

export function createCaptureScenarios(options = {}) {
  const matrixMode = options.matrixMode ?? defaultMatrixMode;
  const cameraPresets = options.cameraPresets ?? defaultCameraPresets;
  const samplesPerPixelMatrix = options.samplesPerPixelMatrix ?? defaultSamplesPerPixelMatrix;
  const denoiseMatrix = options.denoiseMatrix ?? defaultDenoiseMatrix;
  const geometry = options.geometry ?? "mesh";
  const eamesScenarios = eamesPresets.flatMap((preset) =>
    cameraPresets.flatMap((cameraPreset) =>
      samplesPerPixelMatrix.flatMap((samplesPerPixel) =>
        denoiseMatrix.map((denoise) => ({
          id: buildScenarioId({
            validationSceneId: "eames",
            preset,
            geometry,
            cameraPreset,
            samplesPerPixel,
            denoise,
          }),
          validationSceneId: eamesValidationScene.id,
          validationSceneLabel: eamesValidationScene.label,
          validationSceneFamily: eamesValidationScene.family,
          artifactTargets: [...eamesValidationScene.artifactTargets],
          preset,
          geometry,
          cameraPreset,
          denoise,
          samplesPerPixel,
          matrixMode,
          reproCommand: buildScenarioReproCommand({
            validationSceneId: "eames",
            preset,
            geometry,
            cameraPreset,
            denoise,
            samplesPerPixel,
          }),
        }))
      )
    )
  );
  const syntheticCameraPreset = cameraPresets.includes("reference") ? "reference" : cameraPresets[0];
  const syntheticSamplesPerPixel = Math.max(...samplesPerPixelMatrix);
  const syntheticDenoise = denoiseMatrix.includes(false) ? false : denoiseMatrix[0];
  const syntheticScenarios = syntheticValidationScenes.map((scene) => ({
    id: buildScenarioId({
      validationSceneId: scene.id,
      preset: null,
      geometry,
      cameraPreset: syntheticCameraPreset,
      samplesPerPixel: syntheticSamplesPerPixel,
      denoise: syntheticDenoise,
    }),
    validationSceneId: scene.id,
    validationSceneLabel: scene.label,
    validationSceneFamily: scene.family,
    artifactTargets: [...scene.artifactTargets],
    preset: null,
    geometry,
    cameraPreset: syntheticCameraPreset,
    denoise: syntheticDenoise,
    samplesPerPixel: syntheticSamplesPerPixel,
    matrixMode,
    reproCommand: buildScenarioReproCommand({
      validationSceneId: scene.id,
      preset: null,
      geometry,
      cameraPreset: syntheticCameraPreset,
      denoise: syntheticDenoise,
      samplesPerPixel: syntheticSamplesPerPixel,
    }),
  }));
  return [...eamesScenarios, ...syntheticScenarios];
}

function buildFailureDiagnostic(error, scenario, captureUrl) {
  return {
    scenarioId: scenario.id,
    preset: scenario.preset,
    geometry: scenario.geometry,
    cameraPreset: scenario.cameraPreset,
    samplesPerPixel: scenario.samplesPerPixel,
    denoise: scenario.denoise,
    captureUrl,
    reproCommand: scenario.reproCommand,
    message: String(error?.message ?? error ?? "Unknown capture failure."),
    cause: error?.cause ? String(error.cause.message ?? error.cause) : null,
  };
}

function buildBootstrapFailureDiagnostic(error, baseUrl, scenarios) {
  return {
    scenarioId: "browser-bootstrap",
    preset: scenarios[0]?.preset ?? null,
    geometry: scenarios[0]?.geometry ?? "mesh",
    cameraPreset: null,
    samplesPerPixel: null,
    denoise: null,
    captureUrl: new URL("/gpu-lighting/demo/eames-environments/index.html", baseUrl).href,
    reproCommand:
      "Start a WebGPU-capable Chrome with remote debugging and set PLASIUS_CAPTURE_CDP_URL=http://127.0.0.1:<port>.",
    message: String(error?.message ?? error ?? "Browser bootstrap failed."),
    cause: error?.cause ? String(error.cause.message ?? error.cause) : null,
  };
}

function buildCaptureUrl(baseUrl, scenario) {
  const url = new URL("/gpu-lighting/demo/eames-environments/index.html", baseUrl);
  url.searchParams.set("validationScene", scenario.validationSceneId ?? "eames");
  if (scenario.preset) {
    url.searchParams.set("preset", scenario.preset);
  }
  url.searchParams.set("geometry", scenario.geometry);
  url.searchParams.set("width", String(defaultCaptureWidth));
  url.searchParams.set("height", String(defaultCaptureHeight));
  url.searchParams.set("frames", String(defaultCaptureFrames));
  url.searchParams.set("maxDepth", String(defaultCaptureMaxDepth));
  url.searchParams.set("samplesPerPixel", String(scenario.samplesPerPixel));
  url.searchParams.set("denoise", scenario.denoise ? "1" : "0");
  url.searchParams.set("motion", defaultCaptureMotion ? "1" : "0");
  url.searchParams.set("probe", captureProbeReadback ? "1" : "0");
  url.searchParams.set("deferredPathResolve", defaultDeferredPathResolve ? "1" : "0");
  url.searchParams.set("frameIndex", String(defaultCaptureFrameIndex));
  url.searchParams.set("showSources", defaultCaptureShowSources ? "1" : "0");
  url.searchParams.set("cameraPreset", scenario.cameraPreset);
  return url;
}

async function captureScenario(page, baseUrl, scenario) {
  const artifactDirectory = await artifactDirectoryPromise;
  const url = buildCaptureUrl(baseUrl, scenario);

  const readyTimeoutMs = computeCaptureReadyTimeoutMs({
    width: defaultCaptureWidth,
    height: defaultCaptureHeight,
    frames: defaultCaptureFrames,
    maxDepth: defaultCaptureMaxDepth,
    samplesPerPixel: scenario.samplesPerPixel,
  });

  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForCaptureReady(page, scenario.id, readyTimeoutMs);
  const result = await page.evaluate(() => window.__plasiusCaptureResult ?? window.__plasiusCaptureError);
  if (!result || result.status !== "ok") {
    throw new Error(formatCaptureDiagnostic(scenario.id, await readPageDiagnostic(page)));
  }
  if (result.geometry !== "mesh") {
    throw new Error(
      `${scenario.id} captured ${result.geometry} geometry; validation captures must use mesh triangles.`
    );
  }
  if (result.maxDepth !== defaultCaptureMaxDepth) {
    throw new Error(
      `${scenario.id} rendered maxDepth=${result.maxDepth}; expected ${defaultCaptureMaxDepth}.`
    );
  }
  if (result.samplesPerPixel !== scenario.samplesPerPixel) {
    throw new Error(
      `${scenario.id} rendered samplesPerPixel=${result.samplesPerPixel}; expected ${scenario.samplesPerPixel}.`
    );
  }
  if (result.frames !== defaultCaptureFrames) {
    throw new Error(`${scenario.id} rendered frames=${result.frames}; expected ${defaultCaptureFrames}.`);
  }
  if (result.denoise !== scenario.denoise) {
    throw new Error(`${scenario.id} rendered denoise=${result.denoise}; expected ${scenario.denoise}.`);
  }
  if (result.motion !== defaultCaptureMotion) {
    throw new Error(`${scenario.id} rendered motion=${result.motion}; expected ${defaultCaptureMotion}.`);
  }
  if (result.cameraPreset !== scenario.cameraPreset) {
    throw new Error(
      `${scenario.id} rendered cameraPreset=${result.cameraPreset}; expected ${scenario.cameraPreset}.`
    );
  }
  if (result.meshCount <= 0 || result.renderer.triangleCount <= 0) {
    throw new Error(
      `${scenario.id} did not render triangle mesh geometry: ${result.meshCount} meshes, ${result.renderer.triangleCount} renderer triangles.`
    );
  }
  if (
    result.probeReadback &&
    (result.probeSummary.nonZeroSamples <= 0 || !Number.isFinite(result.probeSummary.averageLuminance))
  ) {
    throw new Error(`${scenario.id} rendered a blank or invalid output probe.`);
  }

  const canvasCapture = await readCanvasCapture(page);
  if (!canvasCapture?.dataUrl) {
    throw new Error(`${scenario.id} did not expose a readable render canvas.`);
  }
  const canvasStats = summarizeRgbaPixels(canvasCapture.rgbaBytes);
  const screenshotPath = path.join(artifactDirectory, `${scenario.id}.png`);
  const screenshotBytes = await writePngDataUrl(screenshotPath, canvasCapture.dataUrl);
  if (screenshotBytes < minimumScreenshotBytes) {
    throw new Error(`${scenario.id} screenshot is unexpectedly small: ${screenshotBytes} bytes.`);
  }
  const resultPath = path.join(artifactDirectory, `${scenario.id}.json`);
  const captureUrl = url.href;
  await fs.writeFile(
    resultPath,
    `${JSON.stringify(
      {
        scenario,
        captureUrl,
        reproCommand: scenario.reproCommand,
        canvasStats,
        ...result,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return {
    scenario,
    captureUrl,
    reproCommand: scenario.reproCommand,
    ...result,
    canvasStats,
    screenshot: screenshotPath,
    screenshotBytes,
    screenshotRelative: path.relative(repoRoot, screenshotPath),
    resultFile: resultPath,
    resultRelative: path.relative(repoRoot, resultPath),
  };
}

function renderCaptureSummary(manifest) {
  return [
    `# Validation Scene Screenshots`,
    ``,
    `Matrix mode: ${manifest.matrixMode}`,
    `Scenario count: ${manifest.scenarios.length}`,
    `Resolution: ${defaultCaptureWidth}x${defaultCaptureHeight}`,
    `Frames: ${defaultCaptureFrames}`,
    `Max depth: ${defaultCaptureMaxDepth}`,
    `Deferred: ${defaultDeferredPathResolve ? "on" : "off"}`,
    `Motion: ${defaultCaptureMotion ? "on" : "off"}`,
    `Probe readback: ${captureProbeReadback ? "on" : "off"}`,
    `Frame seed index: ${defaultCaptureFrameIndex}`,
    ``,
    `| Scenario | Validation scene | Artifact targets | Camera | SPP | Denoise | Black | Near <=16 | Avg lum | Lum stddev | Color buckets | Dominant bucket share | Screenshot |`,
    `| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...manifest.results.map((result) => {
      const metrics = result.canvasStats;
      return `| ${result.scenario.id} | ${result.scenario.validationSceneLabel} | ${result.scenario.artifactTargets.join(", ")} | ${result.scenario.cameraPreset} | ${result.scenario.samplesPerPixel} | ` +
        `${result.scenario.denoise ? "on" : "off"} | ${metrics.exactBlackPixels} | ${metrics.nearBlackPixels16} | ` +
        `${metrics.averageLuminance.toFixed(4)} | ${metrics.luminanceStdDev.toFixed(4)} | ` +
        `${metrics.quantizedColorBucketCount} | ${metrics.dominantQuantizedBucketShare.toFixed(4)} | ` +
        `${result.screenshotRelative} |`;
    }),
    ``,
    manifest.failures.length > 0 ? `## Failures` : null,
    ...manifest.failures.map((failure) =>
      `- ${failure.scenarioId}: ${failure.message} | URL: ${failure.captureUrl} | Repro: \`${failure.reproCommand}\``
    ),
    ``,
  ]
    .filter(Boolean)
    .join("\n");
}

async function captureMatrix(geometry) {
  const serverSession = await openCaptureServerSession();
  const scenarios = createCaptureScenarios({ geometry });

  let browserSession;
  try {
    const baseUrl = serverSession.baseUrl;
    try {
      browserSession = await openCaptureBrowser();
    } catch (error) {
      return {
        geometry,
        matrixMode: defaultMatrixMode,
        baseUrl,
        scenarios,
        results: [],
        failures: [buildBootstrapFailureDiagnostic(error, baseUrl, scenarios)],
      };
    }
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
    const failures = [];
    for (const scenario of scenarios) {
      console.log(`capturing ${scenario.id}`);
      try {
        results.push(await captureScenario(page, baseUrl, scenario));
      } catch (error) {
        const failure = buildFailureDiagnostic(error, scenario, buildCaptureUrl(baseUrl, scenario).href);
        failures.push(failure);
        console.error(`${failure.scenarioId} failed: ${failure.message}`);
      }
    }
    return {
      geometry,
      matrixMode: defaultMatrixMode,
      baseUrl: serverSession.baseUrl,
      scenarios,
      results,
      failures,
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
  await fs.writeFile(summaryPath, `${renderCaptureSummary(manifest)}\n`, "utf8");
  console.log(`wrote ${manifestPath}`);
  console.log(`wrote ${summaryPath}`);
  if (manifest.failures.length > 0) {
    throw new Error(
      `Capture matrix completed with ${manifest.failures.length} failure(s). See ${path.relative(repoRoot, manifestPath)}.`
    );
  }
}

if (!globalThis.__PLASIUS_EAMES_CAPTURE_MODULE_ONLY__) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
