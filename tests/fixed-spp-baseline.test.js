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
} from "../scripts/eames-environments/fixed-spp-baseline-capture.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const result = createFixedSppBaselineLaneResult(lane, frames);
  const manifest = createFixedSppBaselineManifest({
    lanes: [lane],
    results: [result],
    runtime: { browser: "Chromium", webgpu: true },
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
