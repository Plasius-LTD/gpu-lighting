import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createGpuDebugSession } from "@plasius/gpu-debug";

import {
  openCaptureBrowser,
  readPageDiagnostic,
  resolveCaptureWorkspaceRoot,
  waitForCaptureReady,
} from "./capture-runtime.mjs";
import { openCaptureServerSession } from "./capture-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");

async function readPackageVersion(packageJsonPath) {
  const manifest = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
    throw new Error(`Package provenance is incomplete at ${packageJsonPath}.`);
  }
  return Object.freeze({ name: manifest.name, version: manifest.version });
}

export async function readFixedSppBaselineProvenance(workspaceRoot) {
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: packageRoot,
    encoding: "utf8",
  }).trim();
  const sourceStatus = execFileSync("git", ["status", "--short"], {
    cwd: packageRoot,
    encoding: "utf8",
  }).trim();
  const packagePaths = [
    path.join(packageRoot, "package.json"),
    path.join(packageRoot, "node_modules/@plasius/gpu-renderer/package.json"),
    path.join(packageRoot, "node_modules/@plasius/gpu-debug/package.json"),
    path.join(packageRoot, "node_modules/@plasius/gpu-shared/package.json"),
    path.join(packageRoot, "node_modules/@plasius/gpu-camera/package.json"),
    path.join(workspaceRoot, "gpu-performance/package.json"),
  ];
  return Object.freeze({
    sourceRevision,
    sourceTreeStatus: sourceStatus.length === 0 ? "clean" : "dirty",
    packages: Object.freeze(await Promise.all(packagePaths.map(readPackageVersion))),
  });
}

export const FIXED_SPP_BASELINE_SCENES = Object.freeze([
  Object.freeze({
    id: "environment-heavy",
    label: "Environment-heavy HDRI",
    validationSceneId: "hdri-skybox",
    preset: null,
    cameraPreset: "reference",
  }),
  Object.freeze({
    id: "outdoor-silhouette",
    label: "Outdoor bright-sky silhouette",
    validationSceneId: "eames",
    preset: "grass-field-midday",
    cameraPreset: "wide",
  }),
  Object.freeze({
    id: "eames-indoor",
    label: "Eames indoor reference",
    validationSceneId: "eames",
    preset: "warehouse-midday",
    cameraPreset: "reference",
  }),
  Object.freeze({
    id: "geometry-heavy",
    label: "All-material geometry-heavy reference",
    validationSceneId: "all-material-direct-light",
    preset: null,
    cameraPreset: "reference",
  }),
]);

export const FIXED_SPP_BASELINE_RESOLUTIONS = Object.freeze([
  Object.freeze({ width: 1920, height: 1080, label: "1080p" }),
  Object.freeze({ width: 2560, height: 1440, label: "1440p" }),
  Object.freeze({ width: 3840, height: 2160, label: "4k" }),
]);

export const FIXED_SPP_BASELINE_BOUNCES = Object.freeze([1, 4, 8]);
export const FIXED_SPP_BASELINE_SPP = Object.freeze([4, 32, 128]);
export const FIXED_SPP_BASELINE_DENOISE = Object.freeze([false, true]);

const STUDENT_T_95 = Object.freeze([
  Number.NaN,
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.16,
  2.145,
  2.131,
  2.12,
  2.11,
  2.101,
  2.093,
  2.086,
  2.08,
  2.074,
  2.069,
  2.064,
  2.06,
  2.056,
  2.052,
  2.048,
  2.045,
]);

function readPositiveInteger(name, value, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return parsed;
}

function readFiniteNonNegative(name, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
  return parsed;
}

function freezeLane(lane) {
  return Object.freeze({ ...lane });
}

export function createFixedSppBaselineMatrix(options = {}) {
  const scenes = options.scenes ?? FIXED_SPP_BASELINE_SCENES;
  const resolutions = options.resolutions ?? FIXED_SPP_BASELINE_RESOLUTIONS;
  const bounces = options.bounces ?? FIXED_SPP_BASELINE_BOUNCES;
  const samplesPerPixel = options.samplesPerPixel ?? FIXED_SPP_BASELINE_SPP;
  const denoiseModes = options.denoiseModes ?? FIXED_SPP_BASELINE_DENOISE;
  const warmupFrameCount = readPositiveInteger(
    "warmupFrameCount",
    options.warmupFrameCount ?? 2
  );
  const measurementFrameCount = readPositiveInteger(
    "measurementFrameCount",
    options.measurementFrameCount ?? 10,
    2
  );

  const lanes = [];
  for (const scene of scenes) {
    for (const resolution of resolutions) {
      const width = readPositiveInteger("resolution.width", resolution.width);
      const height = readPositiveInteger("resolution.height", resolution.height);
      for (const maxDepthValue of bounces) {
        const maxDepth = readPositiveInteger("maxDepth", maxDepthValue);
        for (const sppValue of samplesPerPixel) {
          const spp = readPositiveInteger("samplesPerPixel", sppValue);
          for (const denoise of denoiseModes) {
            if (typeof denoise !== "boolean") {
              throw new Error("denoiseModes must contain booleans.");
            }
            lanes.push(
              freezeLane({
                id: `${scene.id}-${width}x${height}-${maxDepth}b-${spp}spp-denoise-${denoise ? "on" : "off"}`,
                mode: "fixed",
                sceneId: scene.id,
                sceneLabel: scene.label,
                validationSceneId: scene.validationSceneId,
                preset: scene.preset,
                cameraPreset: scene.cameraPreset,
                width,
                height,
                resolutionLabel: resolution.label ?? `${width}x${height}`,
                maxDepth,
                samplesPerPixel: spp,
                denoise,
                warmupFrameCount,
                measurementFrameCount,
              })
            );
          }
        }
      }
    }
  }
  return Object.freeze(lanes);
}

function studentTCritical95(degreesOfFreedom) {
  if (degreesOfFreedom <= 0) {
    throw new Error("degreesOfFreedom must be positive.");
  }
  return STUDENT_T_95[Math.min(degreesOfFreedom, 30)] ?? 1.96;
}

export function computeFixedSppTimingStatistics(values) {
  if (
    !Array.isArray(values) ||
    values.length < 2 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new Error(
      "Fixed-SPP timing statistics require at least two finite non-negative measurements."
    );
  }
  const sampleCount = values.length;
  const mean = values.reduce((total, value) => total + value, 0) / sampleCount;
  const squaredError = values.reduce(
    (total, value) => total + (value - mean) ** 2,
    0
  );
  const sampleStandardDeviation = Math.sqrt(squaredError / (sampleCount - 1));
  const coefficientOfVariation = mean > 0 ? sampleStandardDeviation / mean : 0;
  const margin =
    studentTCritical95(sampleCount - 1) *
    sampleStandardDeviation /
    Math.sqrt(sampleCount);
  return Object.freeze({
    sampleCount,
    mean,
    sampleStandardDeviation,
    coefficientOfVariation,
    confidence95: Object.freeze({
      lower: Math.max(0, mean - margin),
      upper: mean + margin,
      margin,
      method: "two-sided Student t interval",
    }),
    requiredMatchedQualityImprovement: Math.max(
      0.05,
      2 * coefficientOfVariation
    ),
  });
}

function assertObject(name, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value;
}

export function validateFixedSppFrame(lane, frame) {
  assertObject("lane", lane);
  assertObject("frame", frame);
  for (const field of ["width", "height", "maxDepth", "samplesPerPixel"]) {
    if (frame[field] !== lane[field]) {
      throw new Error(
        `${lane.id} frame ${field}=${frame[field]} does not match lane ${lane[field]}.`
      );
    }
  }
  if (frame.renderedSamplesPerPixel !== lane.samplesPerPixel || frame.budgetConstrained) {
    throw new Error(`${lane.id} did not preserve the exact fixed-SPP path.`);
  }

  const expectedPrimaryRays = lane.width * lane.height * lane.samplesPerPixel;
  if (
    frame.primaryRays !== expectedPrimaryRays ||
    frame.rayCounts?.expectedPrimaryRays !== expectedPrimaryRays ||
    frame.rayCounts?.observedPrimaryRays !== expectedPrimaryRays
  ) {
    throw new Error(
      `${lane.id} primary-ray count evidence is inconsistent: ${JSON.stringify({
        expectedPrimaryRays,
        primaryRays: frame.primaryRays,
        rayCounts: frame.rayCounts,
      })}.`
    );
  }
  if (frame.rayCounts?.status !== "available") {
    throw new Error(`${lane.id} exact ray-count evidence is unavailable.`);
  }
  if (
    !Number.isInteger(frame.secondaryRays) ||
    frame.secondaryRays < 0 ||
    frame.totalPathSegments !== frame.primaryRays + frame.secondaryRays ||
    frame.rayCounts.secondaryRays !== frame.secondaryRays ||
    frame.rayCounts.totalPathSegments !== frame.totalPathSegments
  ) {
    throw new Error(`${lane.id} secondary-ray/path-segment evidence is inconsistent.`);
  }
  if (
    !Array.isArray(frame.rayCounts.bounceHistogram) ||
    frame.rayCounts.bounceHistogram.reduce((total, value) => total + value, 0) !==
      frame.totalPathSegments ||
    !Number.isInteger(frame.rayCounts.capturedRayCounts) ||
    frame.rayCounts.capturedRayCounts <= 0 ||
    frame.rayCounts.capturedRayCounts !== frame.rayCounts.expectedRayCounts
  ) {
    throw new Error(`${lane.id} ray histogram evidence is incomplete.`);
  }

  if (
    frame.timings?.status !== "available" ||
    frame.timings?.timestampQueryStatus !== "available" ||
    frame.timings?.source !== "timestamp-query" ||
    !Number.isFinite(frame.timings?.totalGpuTimeMs) ||
    frame.timings.totalGpuTimeMs < 0
  ) {
    throw new Error(`${lane.id} GPU timing evidence is unavailable.`);
  }
  readFiniteNonNegative(
    `${lane.id}.totalRenderJobTimeMs`,
    frame.timings.totalRenderJobTimeMs
  );
  if (!Number.isInteger(frame.telemetryMemoryBytes) || frame.telemetryMemoryBytes <= 0) {
    throw new Error(`${lane.id} telemetry memory evidence is missing.`);
  }
  if (frame.queueOverflow !== 0) {
    throw new Error(`${lane.id} reported queue overflow.`);
  }
  if (frame.deviceLossStatus !== "not-detected") {
    throw new Error(`${lane.id} reported device-loss status ${frame.deviceLossStatus}.`);
  }
  if (
    !frame.transportGuardrails ||
    !["pass", "warn"].includes(frame.transportGuardrails.status)
  ) {
    throw new Error(`${lane.id} transport guardrails did not pass.`);
  }
  return frame;
}

function recordFrameInDebugSession(debug, lane, frame, index) {
  const accepted = debug.recordFixedSppTelemetry({
    owner: "gpu-lighting",
    queueClass: "render",
    frameId: `baseline-${index}`,
    samplesPerPixel: lane.samplesPerPixel,
    renderedSamplesPerPixel: frame.renderedSamplesPerPixel,
    primaryRays: frame.primaryRays,
    secondaryRays: frame.secondaryRays,
    totalPathSegments: frame.totalPathSegments,
    rayCounts: frame.rayCounts,
    timings: frame.timings,
    telemetryMemoryBytes: frame.telemetryMemoryBytes,
  });
  if (!accepted) {
    throw new Error(`${lane.id} debug aggregation rejected frame ${index}.`);
  }
}

export function createFixedSppBaselineLaneResult(lane, frames, options = {}) {
  const requiredFrameCount = lane.warmupFrameCount + lane.measurementFrameCount;
  if (!Array.isArray(frames) || frames.length !== requiredFrameCount) {
    throw new Error(
      `${lane.id} requires ${requiredFrameCount} frames; received ${frames?.length ?? 0}.`
    );
  }
  const validatedFrames = frames.map((frame) => validateFixedSppFrame(lane, frame));
  const measurements = validatedFrames.slice(lane.warmupFrameCount);
  const debug = createGpuDebugSession({
    enabled: true,
    maxRetainedFixedSppSamples: lane.measurementFrameCount,
  });
  measurements.forEach((frame, index) =>
    recordFrameInDebugSession(debug, lane, frame, index)
  );
  const gpuTimes = measurements.map((frame) => frame.timings.totalGpuTimeMs);
  const renderJobTimes = measurements.map(
    (frame) => frame.timings.totalRenderJobTimeMs
  );
  const debugSnapshot = debug.getSnapshot();
  return Object.freeze({
    schemaVersion: 1,
    status: "pass",
    lane,
    warmupFrames: Object.freeze(validatedFrames.slice(0, lane.warmupFrameCount)),
    measurements: Object.freeze(measurements),
    timings: Object.freeze({
      gpu: computeFixedSppTimingStatistics(gpuTimes),
      renderJob: computeFixedSppTimingStatistics(renderJobTimes),
    }),
    rays: Object.freeze({
      primary: debugSnapshot.fixedSpp.totalPrimaryRays,
      secondary: debugSnapshot.fixedSpp.totalMeasuredSecondaryRays,
      totalPathSegments: debugSnapshot.fixedSpp.totalMeasuredPathSegments,
    }),
    memory: Object.freeze({
      peakTelemetryBytes: debugSnapshot.fixedSpp.peakTelemetryMemoryBytes,
      peakRendererHotBufferBytes: Math.max(
        ...measurements.map((frame) =>
          readFiniteNonNegative(
            `${lane.id}.memory.totalHotBufferBytes`,
            frame.memory?.totalHotBufferBytes
          )
        )
      ),
    }),
    stability: Object.freeze({
      queueOverflow: Math.max(...measurements.map((frame) => frame.queueOverflow)),
      deviceLossStatuses: Object.freeze([
        ...new Set(measurements.map((frame) => frame.deviceLossStatus)),
      ]),
      guardrailStatuses: Object.freeze([
        ...new Set(measurements.map((frame) => frame.transportGuardrails.status)),
      ]),
    }),
    hdrProbe: options.probeSummary ?? null,
    debugSnapshot,
  });
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1)
  );
  return sorted[index];
}

function captureProvenance(value) {
  if (!value || !/^[0-9a-f]{40}$/u.test(value.sourceRevision ?? "") ||
      value.sourceTreeStatus !== "clean" || !Array.isArray(value.packages) ||
      value.packages.length === 0 || value.packages.some((entry) =>
        typeof entry.name !== "string" || !entry.name ||
        typeof entry.version !== "string" || !entry.version) ||
      new Set(value.packages.map((entry) => entry.name)).size !== value.packages.length) {
    throw new Error("Fixed-SPP capture provenance is missing or uncommitted.");
  }
  return {
    sourceRevision: value.sourceRevision,
    sourceTreeStatus: value.sourceTreeStatus,
    packages: [...value.packages].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function captureRuntime(value) {
  if (!value || value.webgpu !== true || value.secureContext !== true ||
      typeof value.browserVersion !== "string" || !value.browserVersion ||
      typeof value.adapter?.vendor !== "string" || !value.adapter.vendor) {
    throw new Error("Fixed-SPP physical runtime identity is missing.");
  }
  return {
    webgpu: value.webgpu,
    secureContext: value.secureContext,
    browserVersion: value.browserVersion,
    adapter: value.adapter,
  };
}

export function validateRetainedFixedSppLane(lane, result, provenance, runtime) {
  if (!isDeepStrictEqual(result?.lane, lane)) {
    throw new Error(`Retained fixed-SPP lane configuration differs for ${lane.id}.`);
  }
  if (!isDeepStrictEqual(captureProvenance(result.provenance), captureProvenance(provenance))) {
    throw new Error(`Retained fixed-SPP provenance differs for ${lane.id}.`);
  }
  if (!isDeepStrictEqual(captureRuntime(result.runtime), captureRuntime(runtime))) {
    throw new Error(`Retained fixed-SPP runtime differs for ${lane.id}.`);
  }
  if (typeof result.capturedAt !== "string" || !Number.isFinite(Date.parse(result.capturedAt))) {
    throw new Error(`Retained fixed-SPP capture provenance has no date for ${lane.id}.`);
  }
  const recomputed = createFixedSppBaselineLaneResult(lane, [
    ...(result.warmupFrames ?? []), ...(result.measurements ?? []),
  ], { probeSummary: result.hdrProbe });
  for (const field of ["status", "warmupFrames", "measurements", "timings", "rays", "memory", "stability"]) {
    if (!isDeepStrictEqual(result[field], recomputed[field])) {
      throw new Error(`Retained fixed-SPP derived ${field} differs for ${lane.id}.`);
    }
  }
  return result;
}

export function createFixedSppBaselineManifest({ lanes, results, runtime = {} }) {
  if (!Array.isArray(lanes) || lanes.length === 0) {
    throw new Error("Fixed-SPP baseline manifest requires at least one lane.");
  }
  const resultById = new Map((results ?? []).map((result) => [result.lane.id, result]));
  if (resultById.size !== results?.length || new Set(lanes.map((lane) => lane.id)).size !== lanes.length) {
    throw new Error("Fixed-SPP baseline contains duplicate lane evidence.");
  }
  const missingLaneIds = lanes
    .map((lane) => lane.id)
    .filter((laneId) => !resultById.has(laneId));
  if (missingLaneIds.length > 0 || resultById.size !== lanes.length) {
    throw new Error(
      `Fixed-SPP baseline is missing baseline evidence for ${missingLaneIds.join(", ") || "an unexpected lane"}.`
    );
  }
  const orderedResults = lanes.map((lane) => validateRetainedFixedSppLane(
    lane, resultById.get(lane.id), runtime, runtime
  ));
  if (orderedResults.some((result) => result?.status !== "pass")) {
    throw new Error("Fixed-SPP baseline contains a failed lane.");
  }
  const gpuCoefficients = orderedResults.map(
    (result) => result.timings.gpu.coefficientOfVariation
  );
  const renderJobCoefficients = orderedResults.map(
    (result) => result.timings.renderJob.coefficientOfVariation
  );
  const maximumGpuCoefficientOfVariation = Math.max(...gpuCoefficients);
  return Object.freeze({
    schemaVersion: 2,
    kind: "gpu-native-fixed-spp-baseline",
    status: "pass",
    createdAt: new Date().toISOString(),
    runtime: Object.freeze({ ...runtime }),
    requiredLaneCount: lanes.length,
    completedLaneCount: orderedResults.length,
    lanes: Object.freeze([...lanes]),
    results: Object.freeze(orderedResults),
    variance: Object.freeze({
      method: "per-lane sample CV and two-sided 95% Student t confidence interval",
      maximumGpuCoefficientOfVariation,
      p95GpuCoefficientOfVariation: percentile(gpuCoefficients, 0.95),
      maximumRenderJobCoefficientOfVariation: Math.max(...renderJobCoefficients),
      p95RenderJobCoefficientOfVariation: percentile(renderJobCoefficients, 0.95),
      requiredMatchedQualityImprovement: Math.max(
        0.05,
        2 * maximumGpuCoefficientOfVariation
      ),
    }),
  });
}

function percentage(value) {
  return `${(value * 100).toFixed(2)}%`;
}

export function renderFixedSppBaselineSummary(manifest) {
  return [
    "# GPU-Native Fixed-SPP Baseline",
    "",
    `Status: ${manifest.status}`,
    `Completed lanes: ${manifest.completedLaneCount}/${manifest.requiredLaneCount}`,
    `Coefficient of variation method: ${manifest.variance.method}`,
    `Maximum GPU coefficient of variation: ${percentage(manifest.variance.maximumGpuCoefficientOfVariation)}`,
    `Matched-quality advancement floor: ${percentage(manifest.variance.requiredMatchedQualityImprovement)}`,
    "",
    "| Lane | GPU mean ms | GPU CV | GPU 95% CI | Job mean ms | Primary rays | Segments | Telemetry bytes |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...manifest.results.map(
      (result) =>
        `| ${result.lane.id} | ${result.timings.gpu.mean.toFixed(4)} | ${percentage(result.timings.gpu.coefficientOfVariation)} | ` +
        `${result.timings.gpu.confidence95.lower.toFixed(4)}-${result.timings.gpu.confidence95.upper.toFixed(4)} | ` +
        `${result.timings.renderJob.mean.toFixed(4)} | ${result.rays.primary} | ${result.rays.totalPathSegments} | ` +
        `${result.memory.peakTelemetryBytes} |`
    ),
    "",
  ].join("\n");
}

function buildLaneUrl(baseUrl, lane) {
  const url = new URL(
    "/gpu-lighting/demo/eames-environments/index.html",
    baseUrl
  );
  url.searchParams.set("validationScene", lane.validationSceneId);
  if (lane.preset) {
    url.searchParams.set("preset", lane.preset);
  }
  url.searchParams.set("geometry", "mesh");
  url.searchParams.set("cameraPreset", lane.cameraPreset);
  url.searchParams.set("width", String(lane.width));
  url.searchParams.set("height", String(lane.height));
  url.searchParams.set(
    "frames",
    String(lane.warmupFrameCount + lane.measurementFrameCount)
  );
  url.searchParams.set("maxDepth", String(lane.maxDepth));
  url.searchParams.set("samplesPerPixel", String(lane.samplesPerPixel));
  url.searchParams.set("denoise", lane.denoise ? "1" : "0");
  url.searchParams.set("motion", "0");
  url.searchParams.set("probe", "1");
  url.searchParams.set("readStats", "1");
  url.searchParams.set("awaitGPUCompletion", "1");
  url.searchParams.set("frameTimeBudgetMs", "0");
  url.searchParams.set("frameIndex", "777");
  return url;
}

function laneTimeoutMs(lane) {
  const tiles = Math.ceil(lane.width / 128) * Math.ceil(lane.height / 128);
  const frames = lane.warmupFrameCount + lane.measurementFrameCount;
  const estimate = frames * lane.samplesPerPixel * (lane.maxDepth + 2) * tiles;
  return Math.min(21_600_000, Math.max(120_000, 60_000 + estimate * 40));
}

async function captureLane(page, baseUrl, lane) {
  const url = buildLaneUrl(baseUrl, lane);
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForCaptureReady(page, lane.id, laneTimeoutMs(lane));
  const pageEvidence = await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    const info = adapter?.info ?? {};
    return {
      result: globalThis.__plasiusCaptureResult ?? null,
      error: globalThis.__plasiusCaptureError ?? null,
      runtime: {
        webgpu: Boolean(navigator.gpu),
        secureContext: globalThis.isSecureContext === true,
        browserVersion: navigator.userAgent,
        adapter: {
          vendor: info.vendor ?? null,
          architecture: info.architecture ?? null,
          device: info.device ?? null,
          description: info.description ?? null,
        },
      },
    };
  });
  if (pageEvidence.error || !pageEvidence.result) {
    const diagnostic = await readPageDiagnostic(page);
    throw new Error(
      `${lane.id} failed physical WebGPU capture: ${pageEvidence.error?.message ?? diagnostic?.error?.message ?? "missing page result"}.`
    );
  }
  const frames = pageEvidence.result.renderer?.fixedSppFrames;
  const result = createFixedSppBaselineLaneResult(lane, frames, {
    probeSummary: pageEvidence.result.probeSummary ?? null,
  });
  return { result, runtime: pageEvidence.runtime, captureUrl: url.href };
}

function readMatrixMode(value) {
  const mode = String(value ?? "full").trim().toLowerCase();
  if (!["full", "quick"].includes(mode)) {
    throw new Error("PLASIUS_FIXED_SPP_BASELINE_MATRIX must be 'full' or 'quick'.");
  }
  return mode;
}

function createCliMatrix(mode) {
  const measurementFrameCount = readPositiveInteger(
    "PLASIUS_FIXED_SPP_BASELINE_REPETITIONS",
    process.env.PLASIUS_FIXED_SPP_BASELINE_REPETITIONS ?? (mode === "full" ? 10 : 5),
    2
  );
  const warmupFrameCount = readPositiveInteger(
    "PLASIUS_FIXED_SPP_BASELINE_WARMUPS",
    process.env.PLASIUS_FIXED_SPP_BASELINE_WARMUPS ?? (mode === "full" ? 2 : 1)
  );
  return mode === "full"
    ? createFixedSppBaselineMatrix({ measurementFrameCount, warmupFrameCount })
    : createFixedSppBaselineMatrix({
        scenes: [FIXED_SPP_BASELINE_SCENES[0]],
        resolutions: [{ width: 320, height: 180, label: "smoke" }],
        bounces: [1],
        samplesPerPixel: [4],
        denoiseModes: [false],
        measurementFrameCount,
        warmupFrameCount,
      });
}

async function readRetainedLane(outputDirectory, lane, provenance, runtime) {
  if (process.env.PLASIUS_FIXED_SPP_BASELINE_RESUME === "0") {
    return null;
  }
  try {
    const retained = JSON.parse(
      await fs.readFile(path.join(outputDirectory, "lanes", `${lane.id}.json`), "utf8")
    );
    return validateRetainedFixedSppLane(lane, retained.result, provenance, runtime);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function runFixedSppBaselineCapture(options = {}) {
  const mode = options.mode ?? readMatrixMode(process.env.PLASIUS_FIXED_SPP_BASELINE_MATRIX);
  const lanes = options.lanes ?? createCliMatrix(mode);
  if (mode === "full" && lanes.length !== 216) {
    throw new Error(`Full fixed-SPP baseline requires 216 lanes; received ${lanes.length}.`);
  }
  const workspaceRoot = resolveCaptureWorkspaceRoot();
  const provenance = options.provenance ??
    await readFixedSppBaselineProvenance(workspaceRoot);
  if (mode === "full" && provenance.sourceTreeStatus !== "clean") {
    throw new Error(
      "Full fixed-SPP baseline capture requires a clean committed source tree."
    );
  }
  captureProvenance(provenance);
  const assertCurrentProvenance = async () => {
    if (!isDeepStrictEqual(captureProvenance(await readFixedSppBaselineProvenance(workspaceRoot)),
      captureProvenance(provenance))) {
      throw new Error("Source or package provenance changed during fixed-SPP capture.");
    }
  };
  if (mode === "full" && !isDeepStrictEqual(lanes, createFixedSppBaselineMatrix())) {
    throw new Error("Full fixed-SPP capture requires the canonical 216 lanes with two warmups and ten measurements.");
  }
  const outputDirectory = path.resolve(
    options.outputDirectory ??
      process.env.PLASIUS_FIXED_SPP_BASELINE_OUTPUT_DIR ??
      path.join(workspaceRoot, "output/benchmarks/fixed-spp/task-85")
  );
  await fs.mkdir(path.join(outputDirectory, "lanes"), { recursive: true });
  const server = await openCaptureServerSession({
    canReuse: options.canReuseServer ?? (async () => false),
  });
  let browser = null;
  let page;
  try {
    browser = await openCaptureBrowser();
    page = await browser.context.newPage();
    await page.goto(new URL("/gpu-lighting/package.json", server.baseUrl).href);
    const runtime = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter();
      const info = adapter?.info ?? {};
      return {
        webgpu: Boolean(navigator.gpu),
        secureContext: globalThis.isSecureContext === true,
        browserVersion: navigator.userAgent,
        adapter: {
          vendor: info.vendor ?? null, architecture: info.architecture ?? null,
          device: info.device ?? null, description: info.description ?? null,
        },
      };
    });
    captureRuntime(runtime);
    await page.close();
    page = null;
    const results = [];
    for (const [index, lane] of lanes.entries()) {
      await assertCurrentProvenance();
      const retained = await readRetainedLane(outputDirectory, lane, provenance, runtime);
      if (retained) {
        console.log(`[${index + 1}/${lanes.length}] retained ${lane.id}`);
        results.push(retained);
        continue;
      }
      console.log(`[${index + 1}/${lanes.length}] capturing ${lane.id}`);
      page = await browser.context.newPage({
        viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
      });
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          console.error(`[browser:${message.type()}] ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => console.error(`[browser:pageerror] ${error.message}`));
      const captured = await captureLane(page, server.baseUrl, lane);
      await assertCurrentProvenance();
      captured.result = {
        ...captured.result, provenance, runtime: captured.runtime,
        capturedAt: new Date().toISOString(),
      };
      validateRetainedFixedSppLane(lane, captured.result, provenance, runtime);
      results.push(captured.result);
      await fs.writeFile(
        path.join(outputDirectory, "lanes", `${lane.id}.json`),
        `${JSON.stringify(
          { result: captured.result, runtime: captured.runtime, captureUrl: captured.captureUrl },
          null,
          2
        )}\n`,
        "utf8"
      );
      await page.evaluate(() => globalThis.__plasiusRenderer?.destroy?.());
      await page.close();
      page = null;
    }
    await assertCurrentProvenance();
    const manifest = createFixedSppBaselineManifest({
      lanes,
      results,
      runtime: {
        source: "physical-webgpu",
        matrixMode: mode,
        browserMode: browser.mode,
        platform: process.platform,
        node: process.version,
        packageRoot: path.basename(packageRoot),
        ...provenance,
        ...runtime,
      },
    });
    await fs.writeFile(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(outputDirectory, "summary.md"),
      `${renderFixedSppBaselineSummary(manifest)}\n`,
      "utf8"
    );
    return { manifest, outputDirectory };
  } finally {
    await page?.close();
    await browser?.close();
    await server.close();
  }
}

async function main() {
  if (process.argv[2] === "--verify") {
    const evidencePath = process.argv[3];
    if (!evidencePath) throw new Error("--verify requires a manifest.json path.");
    const retained = JSON.parse(await fs.readFile(evidencePath, "utf8"));
    if (retained.schemaVersion !== 2 || retained.status !== "pass" ||
        retained.requiredLaneCount !== 216 || retained.completedLaneCount !== 216 ||
        retained.runtime?.source !== "physical-webgpu" || retained.runtime?.matrixMode !== "full" ||
        !isDeepStrictEqual(retained.lanes, createFixedSppBaselineMatrix())) {
      throw new Error("Qualifying baseline requires schema 2 and the canonical full matrix; legacy evidence needs recapture.");
    }
    const verified = createFixedSppBaselineManifest(retained);
    if (!isDeepStrictEqual(retained.variance, verified.variance)) {
      throw new Error("Retained baseline variance differs from measured evidence.");
    }
    console.log(`Verified ${verified.completedLaneCount} fixed-SPP lanes with capture provenance.`);
    return;
  }
  const { manifest, outputDirectory } = await runFixedSppBaselineCapture();
  console.log(
    `fixed-SPP baseline ${manifest.status}: ${manifest.completedLaneCount}/${manifest.requiredLaneCount} lanes`
  );
  console.log(`wrote ${outputDirectory}`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
