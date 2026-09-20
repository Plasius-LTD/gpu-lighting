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
