# Fixed relative point comparison

Task #87, renderer#169; Stories site#2119/#2125; Feature site#2114.
Default-off remote flag: `renderer.sampling.fixedPattern.enabled`; no capability
change or public route activation. Three.js remains prohibited.

Renderer owns the complete fixed-point design and source-only pipeline
selection. The candidate replaces all 1D/2D sample dimensions with points shared
across pixels and frames, retains absolute ordinals and a centre first camera
sample. No change to scene/material transport, PDFs, count normalization or
sample budgets. This is deliberately not just a frozen random seed.

Lighting owns original Eames admission and comparisons: native1080p and4K,
four bounces, no denoise, same circular tiers32/16/8/4/2/1 with area shares
5/10/15/20/25/25 percent. Independent random is the control. One warmup and
three rotated timing-only frames per sampler/mode are a short screen only.
Instrumented frames are separate and report counts/rays/segments/GPU spans.

Common reference is the mean of three independent-random fixed32 frames with
seeds7/19/43 (96 samples; not certified convergence). Compare both candidates
to this SAME reference, retaining signed per-ring/global energy, RGB RMSE,
local tails and static frame differences. Also retain same-sampler fixed32
comparisons and require adaptive uniform32 bit identity. Fixed-pattern radial
seeds7/19/43 must be bit-identical, but this is not proof of accuracy. Keep the
pre-existing <=1% per-ring energy screen unchanged and report failures.

Retain full HDR, native PNG, counts, source/device/browser provenance, raw timing,
allocation classes and failures. No coherent-error, aliasing, motion quality,
converged quality, confidence-bound performance or sustained60Hz qualification
is inferred. No memory reduction claim. Rollback disables the experimental flag
and recreates the GPU-native renderer. Tests, coverage, lint/types/build,
package/Zero-Three, docs/ADR/CHANGELOG and post-push CI remain mandatory.
