# Paired adaptive diagnostic protocol

Task gpu-lighting#87 and gpu-renderer#169; Feature site#2114, default-off
`renderer.sampling.adaptivePerPixel.enabled`. No live flag or public renderer change.

Compare corrected fixed transport and the experimental complete-adaptive pipeline
at the same source revision, camera, environment, seed, 32-sample sequence period,
resolution and four-bounce ceiling. Do not compare transport fixes and adaptation
simultaneously. This is a bounded prequalification probe, not the complete matrix.

Use 128x128 smooth-environment and diffuse/thin-emissive/metal silhouette scenes.
Compare fixed32, adaptive-uniform32 (identity control), and preassigned concentric
2/8/32 tiers. The tiers are test inputs, not a qualified importance controller or
permission to reduce risky geometry budgets. No denoise, motion/frame governor,
history, temporal reuse, tone-map-dependent metric or estimator stopping.

Before running adaptive measurements freeze these diagnostic criteria:

- Uniform32 must match fixed32 linear RGB within 1e-5 and exact completed counts.
- Reference convergence: fixed128 versus fixed256 normalized RGB RMSE <= 0.03
  (normalization is reference RMS with 1e-6 floor).
- Reduced tiers must have RGB RMSE and p99 per-pixel maximum-channel absolute
  error <= 1.10 times fixed32's corresponding error against fixed256, plus 1e-5;
  absolute relative scene-energy drift <= 0.01. These provisional diagnostic
  tolerances do not replace the production image-tolerance acceptance process.
- Warm each mode twice; collect ten rounds in rotated mode order. Retain all raw
  timings, seed/order and failures. GPU interval brackets all encoded compaction,
  sampling and count/resolve stages; separately measure host encoding/submission
  through queue completion. Exclude initial shader/resource setup and readback/
  preview from steady-state timing; report them as exclusions. Both modes use the
  same queue-counter telemetry. Presentation is excluded and must be identified:
  the result is a linear-output diagnostic, not a full site render-job speedup.
- Reuse renderer timestamp/ray telemetry and lighting Student-t statistics. No
  unsupported GPU timestamp becomes wall time labelled GPU time. Confidence bounds
  alone never override failed image/convergence or missing production integration.

Retain visible before/after/reference/absolute-error previews using the same
display transfer, raw linear output hashes and metrics, actual primary/secondary
segments, separate buffer/texture/adaptive/telemetry/fixture allocations, source
hashes and physical adapter. Observe all failure cases, stop on invalid completion,
overflow/device loss, and use bounded timeouts/cleanup. No claims of lower memory
from fewer rays. Three.js is permanently prohibited. Rollback stays fixed GPU-native.

Physical results must be reported even when reduced-tier quality or timing fails;
never change tolerances or scene parameters after observing results to claim a pass.
Full Eames, fixed32 noise, 4K, long paths, moving sequences and CI/CD remain open.
