import assert from "node:assert/strict";
import test from "node:test";
import { compareLinearImages, assessPairedTimings, PAIRED_PROBE_LIMITS, assessQuality } from "../demo/eames-environments/paired-adaptive-metrics.js";
import { createPairedProbeScene, createPairedProbeBudgets } from "../demo/eames-environments/paired-adaptive-scenes.js";

test("diagnostic scene and budgets are deterministic and bounded, never an inferred live policy", () => {
  assert.equal(createPairedProbeScene("smooth-environment").meshes.length, 1);
  assert.equal(createPairedProbeScene("diffuse-silhouette").meshes.length, 3);
  assert.throws(()=>createPairedProbeScene("unknown"));
  const budgets = createPairedProbeBudgets(128,128,"reduced");
  assert.deepEqual(new Set(budgets),new Set([2,8,32]));
  assert.deepEqual(budgets, createPairedProbeBudgets(128,128,"reduced"));
  assert.ok(createPairedProbeBudgets(2,2,"uniform").every(value=>value===32));
  for (const args of [[0,1,"uniform"],[129,129,"uniform"],[2,2,"bad"]]) assert.throws(()=>createPairedProbeBudgets(...args));
});

test("linear metrics reject invalid evidence and preserve HDR/energy/local errors", () => {
  const reference = new Float32Array([2, 1, 0, 1, 0, 0, 0, 1]);
  assert.equal(compareLinearImages(reference, reference).rgbRmse, 0);
  const changed = new Float32Array([4, 1, 0, 1, 0, 0, 0, 1]);
  const result = compareLinearImages(changed, reference);
  assert.equal(result.maxAbsoluteError, 2); assert.equal(result.p99LocalError, 2);
  assert.ok(Math.abs(result.rgbRmse - Math.sqrt(4 / 6)) < 1e-10);
  assert.ok(result.relativeEnergyDrift > 0);
  for (const invalid of [[], new Float32Array(0), new Float32Array([NaN,0,0,1]), new Float32Array([1,0,0,0]), new Float32Array([-1,0,0,1])]) {
    assert.throws(() => compareLinearImages(invalid, reference));
  }
  assert.equal(compareLinearImages(new Float32Array([0,0,0,1]), new Float32Array([0,0,0,1])).relativeEnergyDrift, 0);
});

test("quality gates do not turn a faster noisy or unconverged image into a pass", () => {
  const metric = { rgbRmse: 0.01, p99LocalError: 0.03, relativeEnergyDrift: 0, normalizedRmse: 0.01 };
  assert.equal(assessQuality(metric, metric, metric).passed, true);
  assert.equal(assessQuality({ ...metric, rgbRmse: 0.02 }, metric, metric).passed, false);
  assert.equal(assessQuality(metric, metric, { ...metric, normalizedRmse: 0.1 }).passed, false);
  assert.equal(assessQuality({ ...metric, relativeEnergyDrift: -0.02 }, metric, metric).passed, false);
  assert.equal(PAIRED_PROBE_LIMITS.identityAbsoluteError, 1e-5);
});

test("paired timing preserves slower results and rejects missing/zero or unpaired evidence", () => {
  const fixed = Array(10).fill(10);
  assert.equal(assessPairedTimings(fixed, Array(10).fill(8)).timingPassed, true);
  assert.equal(assessPairedTimings(fixed, Array(10).fill(12)).timingPassed, false);
  assert.ok(assessPairedTimings(fixed, Array(10).fill(12)).meanImprovement < 0);
  for (const after of [[1], Array(10).fill(0), Array(10).fill(NaN)]) assert.throws(() => assessPairedTimings(fixed, after));
});
