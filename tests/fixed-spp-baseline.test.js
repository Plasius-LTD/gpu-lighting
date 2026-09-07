import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FIXED_SPP_BASELINE_SCENES,
  computeFixedSppTimingStatistics,
  createFixedSppBaselineLaneResult,
  createFixedSppBaselineManifest,
  createFixedSppBaselineMatrix,
  readFixedSppBaselineProvenance,
  renderFixedSppBaselineSummary,
  runFixedSppBaselineCapture,
  validateFixedSppFrame,
  validateRetainedFixedSppLane,
} from "../scripts/eames-environments/fixed-spp-baseline-capture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const provenance = {
  sourceRevision: "a".repeat(40),
  sourceTreeStatus: "clean",
  packages: [{ name: "@plasius/gpu-renderer", version: "0.2.43" }],
};
const runtime = {
  webgpu: true,
  secureContext: true,
  browserVersion: "test-browser-1",
  adapter: { vendor: "apple", architecture: "metal-3", device: "", description: "" },
};

function capturedResult(lane = createLane()) {
  return {
    ...createFixedSppBaselineLaneResult(lane, [20, 8, 9, 10, 11].map(
      (ms) => createFrame(lane, ms, ms + 1)
    )),
    provenance,
    runtime,
    capturedAt: "2026-09-01T00:00:00.000Z",
  };
}

test("resumed evidence rejects absent or changed source, package, browser, and adapter identities", () => {
  const result = capturedResult();
  assert.deepEqual(validateRetainedFixedSppLane(result.lane, result, provenance, runtime), result);
  for (const invalid of [
    { ...result, provenance: undefined },
    { ...result, runtime: undefined },
    { ...result, provenance: { ...provenance, sourceRevision: "b".repeat(40) } },
    { ...result, provenance: { ...provenance, sourceTreeStatus: "dirty" } },
    { ...result, provenance: { ...provenance, packages: [{ name: "@plasius/gpu-renderer", version: "0.2.41" }] } },
    { ...result, runtime: { ...runtime, browserVersion: "test-browser-2" } },
    { ...result, runtime: { ...runtime, adapter: { ...runtime.adapter, vendor: "different" } } },
  ]) {
    assert.throws(() => validateRetainedFixedSppLane(result.lane, invalid, provenance, runtime), /provenance|runtime/);
  }
});

test("resumed pass labels cannot bypass raw-frame admission or recomputed statistics", () => {
  const result = capturedResult();
  const invalidFrames = { ...result, measurements: result.measurements.map((frame, i) => i ? frame : { ...frame, primaryRays: 1 }) };
  assert.throws(() => validateRetainedFixedSppLane(result.lane, invalidFrames, provenance, runtime), /primary-ray/);
  assert.throws(() => validateRetainedFixedSppLane(result.lane, { ...result, timings: { ...result.timings, gpu: { ...result.timings.gpu, mean: 0 } } }, provenance, runtime), /derived/);
  assert.throws(() => validateRetainedFixedSppLane({ ...result.lane, denoise: true }, result, provenance, runtime), /lane/);
});

test("manifests reject duplicate lanes, mixed provenance, and missing capture identity", () => {
  const result = capturedResult();
  const options = { lanes: [result.lane], results: [result], runtime: { ...runtime, ...provenance } };
  assert.equal(createFixedSppBaselineManifest(options).status, "pass");
  assert.throws(() => createFixedSppBaselineManifest({ ...options, results: [result, result] }), /duplicate/);
  assert.throws(() => createFixedSppBaselineManifest({ ...options, results: [{ ...result, provenance: undefined }] }), /provenance/);
  assert.throws(() => createFixedSppBaselineManifest({ ...options, runtime: { ...options.runtime, sourceRevision: "b".repeat(40) } }), /provenance/);
});

function createLane(overrides = {}) {
  return {
    id: "environment-heavy-1920x1080-1b-4spp-denoise-off",
    mode: "fixed",
    sceneId: "environment-heavy",
    validationSceneId: "hdri-skybox",
    preset: null,
    cameraPreset: "reference",
    width: 4,
    height: 2,
    maxDepth: 1,
    samplesPerPixel: 4,
    denoise: false,
    warmupFrameCount: 1,
    measurementFrameCount: 4,
    ...overrides,
  };
}

function createFrame(lane, totalGpuTimeMs, totalRenderJobTimeMs) {
  const primaryRays = lane.width * lane.height * lane.samplesPerPixel;
  const bounceHistogram = Array.from(
    { length: lane.samplesPerPixel },
    () => lane.width * lane.height
  );
  return {
    frame: 1,
    width: lane.width,
    height: lane.height,
    maxDepth: lane.maxDepth,
    samplesPerPixel: lane.samplesPerPixel,
    renderedSamplesPerPixel: lane.samplesPerPixel,
    budgetConstrained: false,
    primaryRays,
    secondaryRays: 0,
    totalPathSegments: primaryRays,
    rayCounts: {
      status: "available",
      source: "gpu-active-queue-readback",
      expectedPrimaryRays: primaryRays,
      observedPrimaryRays: primaryRays,
      secondaryRays: 0,
      totalPathSegments: primaryRays,
      bounceHistogram,
      capturedRayCounts: 16,
      expectedRayCounts: 16,
      reason: null,
    },
    timings: {
      status: "available",
      source: "timestamp-query",
      timestampQueryStatus: "available",
      totalGpuTimeMs,
      totalRenderJobTimeMs,
      classificationTimeMs: null,
      compactionTimeMs: null,
      samplingTimeMs: null,
      reason: null,
    },
    telemetryMemoryBytes: 48,
    queueOverflow: 0,
    deviceLossStatus: "not-detected",
    transportGuardrails: { status: "pass" },
    memory: { totalHotBufferBytes: 4096 },
  };
}

test("fixed-SPP baseline matrix retains every required scene, resolution, bounce, SPP, and denoise lane", () => {
  assert.deepEqual(
    FIXED_SPP_BASELINE_SCENES.map((scene) => scene.id),
    ["environment-heavy", "outdoor-silhouette", "eames-indoor", "geometry-heavy"]
  );

  const lanes = createFixedSppBaselineMatrix();
  assert.equal(lanes.length, 4 * 3 * 3 * 3 * 2);
  assert.equal(new Set(lanes.map((lane) => lane.id)).size, lanes.length);
  assert.deepEqual([...new Set(lanes.map((lane) => `${lane.width}x${lane.height}`))], [
    "1920x1080",
    "2560x1440",
    "3840x2160",
  ]);
  assert.deepEqual([...new Set(lanes.map((lane) => lane.maxDepth))], [1, 4, 8]);
  assert.deepEqual([...new Set(lanes.map((lane) => lane.samplesPerPixel))], [4, 32, 128]);
  assert.deepEqual([...new Set(lanes.map((lane) => lane.denoise))], [false, true]);
  assert.ok(lanes.every((lane) => lane.mode === "fixed"));
  assert.ok(lanes.every((lane) => lane.warmupFrameCount === 2));
  assert.ok(lanes.every((lane) => lane.measurementFrameCount === 10));
});

test("fixed-SPP timing statistics publish sample CV, 95% confidence, and advancement floor", () => {
  const stats = computeFixedSppTimingStatistics([8, 9, 10, 11, 12]);
  assert.equal(stats.sampleCount, 5);
  assert.equal(stats.mean, 10);
  assert.ok(Math.abs(stats.sampleStandardDeviation - Math.sqrt(2.5)) < 1e-12);
  assert.ok(Math.abs(stats.coefficientOfVariation - Math.sqrt(2.5) / 10) < 1e-12);
  assert.ok(stats.confidence95.lower < 10);
  assert.ok(stats.confidence95.upper > 10);
  assert.equal(stats.requiredMatchedQualityImprovement, stats.coefficientOfVariation * 2);
  assert.throws(
    () => computeFixedSppTimingStatistics([10]),
    /at least two finite non-negative measurements/
  );
});

test("fixed-SPP frame admission fails closed on transport, ray, timing, and stability evidence", () => {
  const lane = createLane();
  const frame = createFrame(lane, 9, 10);
  assert.equal(validateFixedSppFrame(lane, frame).primaryRays, 32);
  assert.ok(frame.rayCounts.capturedRayCounts > frame.rayCounts.bounceHistogram.length);

  assert.throws(
    () => validateFixedSppFrame(lane, { ...frame, primaryRays: 31 }),
    /primary-ray count/
  );
  assert.throws(
    () => validateFixedSppFrame(lane, { ...frame, queueOverflow: 1 }),
    /queue overflow/
  );
  assert.throws(
    () => validateFixedSppFrame(lane, { ...frame, deviceLossStatus: "lost" }),
    /device-loss status/
  );
  assert.throws(
    () => validateFixedSppFrame(lane, { ...frame, timings: { ...frame.timings, totalGpuTimeMs: null } }),
    /GPU timing evidence/
  );
  assert.throws(
    () => validateFixedSppFrame(lane, { ...frame, transportGuardrails: { status: "failed" } }),
    /transport guardrails/
  );
});

test("fixed-SPP lane results use bounded debug aggregation and exclude warmup timing", () => {
  const lane = createLane();
  const frames = [
    createFrame(lane, 20, 22),
    createFrame(lane, 8, 9),
    createFrame(lane, 9, 10),
    createFrame(lane, 10, 11),
    createFrame(lane, 11, 12),
  ];
  const result = createFixedSppBaselineLaneResult(lane, frames, {
    probeSummary: { averageLuminance: 1.25, maxLuminance: 4.5 },
  });

  assert.equal(result.measurements.length, 4);
  assert.equal(result.debugSnapshot.fixedSpp.sampleCount, 4);
  assert.equal(result.debugSnapshot.fixedSpp.totalPrimaryRays, 128);
  assert.equal(result.timings.gpu.mean, 9.5);
  assert.equal(result.timings.renderJob.mean, 10.5);
  assert.equal(result.stability.queueOverflow, 0);
  assert.equal(result.hdrProbe.averageLuminance, 1.25);
});

test("fixed-SPP manifest rejects missing lanes and renders retained evidence", () => {
  const lane = createLane();
  const frames = [
    createFrame(lane, 20, 22),
    createFrame(lane, 8, 9),
    createFrame(lane, 9, 10),
    createFrame(lane, 10, 11),
    createFrame(lane, 11, 12),
  ];
  const result = { ...createFixedSppBaselineLaneResult(lane, frames), provenance, runtime, capturedAt: "2026-09-01T00:00:00.000Z" };
  const manifest = createFixedSppBaselineManifest({
    lanes: [lane],
    results: [result],
    runtime: { ...runtime, ...provenance },
  });
  assert.equal(manifest.status, "pass");
  assert.equal(manifest.completedLaneCount, 1);
  assert.equal(manifest.requiredLaneCount, 1);
  assert.match(renderFixedSppBaselineSummary(manifest), /Coefficient of variation/);
  assert.match(renderFixedSppBaselineSummary(manifest), /environment-heavy/);

  assert.throws(
    () => createFixedSppBaselineManifest({ lanes: [lane], results: [] }),
    /missing baseline evidence/
  );
});

test("fixed-SPP provenance binds source revision and participating package versions", async () => {
  const workspaceRoot = path.resolve(__dirname, "../../..");
  const provenance = await readFixedSppBaselineProvenance(workspaceRoot);
  assert.match(provenance.sourceRevision, /^[0-9a-f]{40}$/u);
  assert.ok(["clean", "dirty"].includes(provenance.sourceTreeStatus));
  assert.deepEqual(
    provenance.packages.map((entry) => entry.name),
    [
      "@plasius/gpu-lighting",
      "@plasius/gpu-renderer",
      "@plasius/gpu-debug",
      "@plasius/gpu-shared",
      "@plasius/gpu-camera",
      "@plasius/gpu-performance",
    ]
  );
  assert.equal(
    provenance.packages.find((entry) => entry.name === "@plasius/gpu-debug")?.version,
    "0.2.7"
  );
});

test("full fixed-SPP capture rejects incomplete matrices and dirty provenance before browser work", async () => {
  const lanes = createFixedSppBaselineMatrix();
  await assert.rejects(
    runFixedSppBaselineCapture({
      mode: "full",
      lanes: [lanes[0]],
      provenance: { sourceTreeStatus: "clean" },
    }),
    /requires 216 lanes/
  );
  await assert.rejects(
    runFixedSppBaselineCapture({
      mode: "full",
      lanes,
      provenance: { sourceTreeStatus: "dirty" },
    }),
    /requires a clean committed source tree/
  );
});
