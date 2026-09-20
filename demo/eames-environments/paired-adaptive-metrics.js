import { computeFixedSppTimingStatistics } from "../../scripts/eames-environments/timing-statistics.js";

export const PAIRED_PROBE_LIMITS = Object.freeze({
  identityAbsoluteError: 1e-5, referenceNormalizedRmse: 0.03,
  errorRatio: 1.10, errorSlack: 1e-5, absoluteEnergyDrift: 0.01,
  rounds: 10, warmups: 2,
});

export function compareLinearImages(candidate, reference) {
  if (!(candidate instanceof Float32Array) || !(reference instanceof Float32Array)
    || candidate.length === 0 || candidate.length !== reference.length || candidate.length % 4) throw new Error("Invalid linear image dimensions.");
  const pixels = candidate.length / 4, errors = [];
  let square = 0, referenceSquare = 0, energy = 0, referenceEnergy = 0, lumaError = 0, maxLumaError = 0, maxError = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    if (candidate[pixel * 4 + 3] !== 1 || reference[pixel * 4 + 3] !== 1) throw new Error("Incomplete linear image.");
    let local = 0, deltaLuma = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = candidate[pixel * 4 + channel], expected = reference[pixel * 4 + channel];
      if (!Number.isFinite(value) || !Number.isFinite(expected) || value < 0 || expected < 0) throw new Error("Invalid HDR radiance.");
      const delta = value - expected, weight = [0.2126, 0.7152, 0.0722][channel];
      square += delta * delta; referenceSquare += expected * expected;
      energy += value * weight; referenceEnergy += expected * weight; deltaLuma += delta * weight;
      local = Math.max(local, Math.abs(delta));
    }
    lumaError += Math.abs(deltaLuma); maxLumaError = Math.max(maxLumaError, Math.abs(deltaLuma));
    errors.push(local); maxError = Math.max(maxError, local);
  }
  errors.sort((a,b) => a-b);
  const rgbRmse = Math.sqrt(square / (pixels * 3)), referenceRms = Math.sqrt(referenceSquare / (pixels * 3));
  return { pixels, rgbRmse, normalizedRmse: rgbRmse / Math.max(1e-6, referenceRms),
    maxAbsoluteError: maxError, p95LocalError: errors[Math.ceil(0.95 * pixels) - 1], p99LocalError: errors[Math.ceil(0.99 * pixels) - 1],
    meanLuminanceAbsoluteError: lumaError / pixels, maxLuminanceAbsoluteError: maxLumaError,
    meanLuminance: energy / pixels, referenceMeanLuminance: referenceEnergy / pixels,
    relativeEnergyDrift: (energy - referenceEnergy) / Math.max(referenceEnergy, 1e-6 * pixels) };
}

export function assessQuality(candidate, fixed, convergence) {
  const limits = PAIRED_PROBE_LIMITS;
  const checks = { converged: convergence.normalizedRmse <= limits.referenceNormalizedRmse,
    rmse: candidate.rgbRmse <= fixed.rgbRmse * limits.errorRatio + limits.errorSlack,
    local: candidate.p99LocalError <= fixed.p99LocalError * limits.errorRatio + limits.errorSlack,
    energy: Math.abs(candidate.relativeEnergyDrift) <= limits.absoluteEnergyDrift };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function assessPairedTimings(fixed, candidate) {
  if (!Array.isArray(fixed) || !Array.isArray(candidate) || fixed.length < PAIRED_PROBE_LIMITS.rounds
    || fixed.length !== candidate.length || [...fixed,...candidate].some(value=> !Number.isFinite(value) || value <= 0)) {
    throw new Error("Require paired positive finite timing evidence.");
  }
  const baseline = computeFixedSppTimingStatistics(fixed), after = computeFixedSppTimingStatistics(candidate);
  const ratios = computeFixedSppTimingStatistics(candidate.map((value,i)=>value/fixed[i]));
  const lower95Improvement = 1 - ratios.confidence95.upper;
  return { baseline, after, meanImprovement: 1 - ratios.mean, lower95Improvement,
    method: "one minus upper two-sided 95% Student-t interval of paired after/before ratios",
    requiredImprovement: baseline.requiredMatchedQualityImprovement,
    timingPassed: lower95Improvement >= baseline.requiredMatchedQualityImprovement };
}
