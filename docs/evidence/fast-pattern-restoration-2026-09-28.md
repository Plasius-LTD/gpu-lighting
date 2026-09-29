# Fast-pattern restoration and lighting investigation — 28 September 2026

Status: **fast fixed-pattern restored as the local experimental working lane**.
Stable-pattern is retained only as an explicit comparison; neither is production
qualified. Tasks renderer#169 / lighting#87, Feature site#2114.

## Why the direction changed
The retained like-for-like four-bounce native4K jobs are 8776.00 ms for fast
fixed-pattern and 17777.60 ms for stable-pattern. Mean brightness improved, but
visible tier boundaries and grain remain. This is not an accepted quality/time
trade-off. The six-bounce stable image is not a like-for-like timing benchmark.
The earlier claim that bands were absent was too broad and is withdrawn.
Ring-average brightness cannot establish local contrast, colour or boundary quality.

Only the diagnostic UI default changes. Existing flags remain mutually exclusive
and production-default off. No shader, source sequence, transport, exposure,
normalization, memory allocation, camera, scene, depth or budget changes.
The unchanged shader is selected through renderer.sampling.fixedPattern.enabled;
renderer.sampling.stablePattern.enabled remains available for comparison.
The old native-stable-reference.html URL is retained, but its UI and receipt
explicitly identify the selected sampler. Artifact names cannot mix the modes.

## Reproduced structural sampling defect
The fast sampler reuses the same two Sobol components for every event; event
separation is only a fixed XOR shift. For any two event first components,
xA XOR xB is a constant, independent of sample ordinal. Their leading bits are
therefore either identical or opposite, not independently covering the joint domain.

The requirement-derived characterization test evaluates existing functions,
without changing the sampler. At bounce0, for 32 and1024 ordinals, these pairs
produce quadrant counts [0,N/2,N/2,0], rather than [N/4,N/4,N/4,N/4]:

- emissiveLightSelection (dimension31) versus emissiveLightSurface U (32);
- bsdfLobeSelector (21) versus diffuseHemisphere U (22);
- directLightSelector (41) versus directEnvironment U (42).

Each scalar marginal is balanced, so the previous per-pair/marginal tests do not
catch this. The analytic indicator integral over the lower-left quadrant should
be0.25, while this construction returns0. Increasing the ordinal count does not
repair that missing half-domain.

The actual shader consumes those samples for conditional light/lobe selection
and surface/direction sampling. This provides a concrete bias mechanism: the
conditional surface/direction distribution can differ from the distribution
used in its PDF. It is NOT yet a measurement of how much of the Eames error is
caused by each event, nor proof that replacing only these dimensions fixes the image.
The existing GPU probe verifies CPU/WGSL parity, not statistical correctness.

## Next experiments, in priority order (not implemented here)
1. **Distinct deterministic dimensions per event and bounce.** Use a genuine
   multidimensional direction-number construction instead of reusing a pair with
   different XOR constants. Keep camera sample0 at the centre and keep lighting
   points shared across pixels initially, preserving the coherence hypothesis.
   Reuse the renderer sampling interface and shader assembly. Check joint
   occupancy, conditional analytic integrals, event/bounce coverage, prefix
   invariance and CPU/GPU parity before images. A new default-off sampler flag
   must isolate it from both controls. A lookup table or shader constants must
   have measured memory/compile costs; do not assume this recovers performance.
   Primary reference: [PBRT's dimension-specific Sobol generators](https://pbr-book.org/4ed/Sampling_and_Reconstruction/Sobol_Samplers).
2. **Selective spatial variation, not blanket per-pixel scrambling.** Isolate
   light-class selection, emitter selection/surface and BSDF dimensions one group
   at a time. Coarse shared groups may preserve GPU coherence but can introduce
   block boundaries, aliasing and motion artifacts. Compare both artifacts and
   timing; do not call grouping a fix without those checks.
3. **Source-aware low-sample lighting.** Where gpu-lighting can provide a justified
   analytic or importance-sampled contribution, evaluate that contribution and
   sample its residual with matching PDF/MIS. Finite-area visibility and general
   indirect lighting cannot simply be replaced with point-light/constant colour.
   This changes the estimator and needs a separate design and energy/furnace tests.
4. **Tier-boundary scheduling only after the estimator is sound.** Smooth or
   spatially interleave adjacent budgets while preserving expected samples and
   absolute ordinals. This may reduce visible circles but cannot cure correlated
   lighting or prove less noise. Freeze ray budget and include compaction cost.

No exposure multiplier, per-ring gain, contrast curve, white-balance tweak or
denoiser is accepted as repair of an incorrectly sampled integral. Presentation
can be assessed later, separately, against linear-HDR evidence.

## Required acceptance for a replacement
Keep both old controls and original source Eames. Compare identical dimensions,
SPP distribution, bounces and camera. Freeze tests before capture: per-channel
signed error, local patch bias/RMSE, boundary residuals (not whole-ring averages),
silhouette/local tails, grain/variance and motion/focus changes. Use independent,
convergence-qualified references for quality claims. Retain denoise-off images.
Measure timing-only CPU/GPU/job costs and ray/segment/dispatch counts separately
from diagnostics. Improve quality without unqualified cost increases; then apply
the existing matched-quality confidence gate. No production or white-paper claim.

Implementation evidence: the unchanged [fixed-pattern generator](https://github.com/Plasius-LTD/gpu-renderer/blob/00c8f4f67402dfe7f950a75359e5acaf09dc467c/src/wavefront-fixed-pattern.js)
and [conditional light sampling](https://github.com/Plasius-LTD/gpu-renderer/blob/00c8f4f67402dfe7f950a75359e5acaf09dc467c/src/wavefront-shader-lighting.js).

## Restored physical reference and validation

The restored control was captured on 28 September on the physical non-fallback
adapter using renderer commit `498e2ee58a57a24fcd9d8e627400bc598a296b97` and
lighting commit `71ea0a1174b1494fa56aec8bbbdb1ee4f5ebdd46`. The receipt pins the
site/shared commits and hashes the original geometry/textures as well.

- [Native 3840 × 2160 PNG](./eames-4k-adaptive-fixed-6-bounces-2026-09-28.png).
- [Capture receipt](./fast-reference-4k-2026-09-28-receipt.json).
- [Independent artifact verification](./fast-reference-4k-2026-09-28-verification.json).
- Six-bounce ceiling; 265,476 triangles; 137,735 BVH nodes; denoise off.
- Each frame completed 49,351,680 camera samples (5.95 average SPP),
  67,467,698 secondary rays and 116,819,378 total path segments across 510 tiles.
- Seeds 7 and 19 produced identical linear HDR and bounce histograms. All
  17,408 CPU/WGSL probe words matched; no GPU validation errors; cleanup passed.
- Application-visible GPU allocations including textures, telemetry and staging:
  452,530,816 bytes. This is not physical VRAM residency or a memory reduction.

The verifier decompressed all 32 HDR chunks, checked their individual hashes,
the full 132,710,400-byte image hash, finite float values, per-tile completed
counts, timestamp spans and source asset hashes. Full HDR chunks remain in the
local `output/playwright/eames-environments/` capture directory identified by
the receipt; they are not portable evidence in this repository yet. PNG SHA-256:
`2e8171b93ab1d0d99ea66dfe0afb7b0df56cc533ca5470443be711cf35600a6f`.
Linear HDR SHA-256:
`d686f4d99105f7be127b481f3230045157ff075ded737b99bd9cc5f579ef9664`.

Visual inspection confirms visible rings and structured low-sample lighting;
this is the restored unresolved control, not an improved image or promotion
material. Diagnostic readback-inclusive durations were 11,575.80 and 11,498.30 ms;
summed instrumented tile GPU spans were 8,420.52 and 8,452.24 ms. These are NOT
timing-only benchmark samples, an FPS claim or matched-quality improvement.

Browser checks verified the fast default, explicit slower comparison and warning,
locked controls during capture, cancellation followed by usable controls,
clearing the old preview/download/receipt on sampler change, and restart.
Keyboard activation was used after automated pointer activation had no effect.
A 390-pixel viewport was visually inspected and reset; this does not qualify
mobile GPU support. Browser download automation was not repeated because it
disconnected the browser previously; the capture bridge retained and verified
the original PNG directly. The deliberately cancelled comparison is excluded
from rendering evidence and remains retained locally as a failure receipt.

Renderer validation: 324 tests passed, 96.07% line coverage, lint, typecheck,
build, packed-consumer/package checks and full Zero-Three validation passed.
Lighting changes are documentation/evidence only; local Zero-Three and whitespace
checks passed, with the remaining package gates run in CI. Renderer
[post-push CI](https://github.com/Plasius-LTD/gpu-renderer/actions/runs/36398933008)
and lighting
[source-capture CI](https://github.com/Plasius-LTD/gpu-lighting/actions/runs/36398956657)
succeeded. No runtime shader changes, production enablement, release or CD run
were performed. Tasks and the Feature remain open for quality qualification.
The renderer CI's optional Codecov install/upload still fails on the runner
because Python pip/codecovcli is missing; the enforced LCOV gate itself passed
at 96.08%. Do not interpret the green job as a successful external coverage upload.
