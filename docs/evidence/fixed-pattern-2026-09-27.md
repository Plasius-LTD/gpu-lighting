# Fixed relative sampling — 27 September 2026

Status: **experiment completed; brightness gate failed at both resolutions;
not production, matched-quality performance or real-time qualified**.
Tasks renderer#169 / lighting#87; Feature site#2114. Flags remain off.

## Result

Fixed relative points eliminate changes between the three static frame seeds
and materially reduce measured job time. They also lower RGB RMSE and local
error tails against the common reference in this scene. However, images exhibit
coherent angular lighting patches, shadow steps and SPP rings. Total scene
brightness is about3.2% low; the8-SPP region is about7.2% low.

This supports further deterministic-sampling experiments, not enabling this
pattern. It does not show that pixel-centre camera rays are wrong or that random
sampling is mandatory. This particular pattern shares the first two Sobol
generator dimensions across events using fixed digital shifts; it is NOT a
full high-dimensional Sobol construction. Cross-event correlation and shared
spatial errors remain important limitations. Do not generalise its defects to
every deterministic quadrature scheme.

## Implementation and protocol

Default-off `renderer.sampling.fixedPattern.enabled` selects a dedicated shader
at renderer creation. All1D selectors and2D camera/light/bounce samples use
fixed relative points independent of pixel, frame and seed. The camera's first
sample is exactly its pixel centre. Higher ordinals remain budget-independent.
Lighting directions remain relative to the local surface/light frame, not
identical world-space directions across different surfaces.

The two existing progressive sampler flags are mutually exclusive with this
flag. No extra sampling buffers, textures, passes, CPU sample cache or transport
changes are introduced. Disable sampler flags and recreate for GPU-native
rollback; the default shader source remains byte-identical.

Native1920x1080 and3840x2160, original Eames source model265468 triangles,
all five original1024-square textures, canonical shared Product Studio room,
lighting and camera; submitted geometry265476 triangles. Four-bounce ceiling,
denoise off, no fused transport, no frame-budget reduction, no temporal reuse.
Circular area shares5/10/15/20/25/25% at32/16/8/4/2/1SPP (mean5.95).
This is full-source renderer execution, not the complete GPU-tab application.

One warmup and three rotated timing-only frames per sampler/mode/resolution;
diagnostic readback and image retention are separate. Total56 completed frames:
24 timing,24 diagnostic and8 warmup. Static frame seeds7/19/43.
Common reference is the mean of independent-random fixed32 seeds7/19/43
(96 samples). It is not certified converged and shares samples with the random
control, so these errors are a screen, not an unbiased ranking against truth.

## Completed job timing

Milliseconds; includes renderer submission/queue completion/presentation work,
not asset loading, pipeline creation or diagnostic capture. These are seconds
when converted, not evidence of60Hz rendering. Three frames do not establish a
confidence-bound performance qualification; candidates are not matched-quality.

| Resolution | Budget | Random control ms | Fixed pattern ms | Lower job time |
| --- | --- | ---: | ---: | ---: |
| 1080p | Uniform32 | 17014.10 | 7122.80 | 58.14% |
| 1080p | Radial5.95 | 5199.70 | 2870.07 | 44.80% |
| 4K | Uniform32 | 63666.20 | 22813.57 | 64.17% |
| 4K | Radial5.95 | 17780.93 | 8568.53 | 51.81% |

The random control retains its existing experimental shader, while the fixed
candidate uses a dedicated source. Sampling arithmetic, shader code shape and
ray coherence all change. This experiment does not isolate their individual
contributions. Do not attribute the entire difference to removing randomness.

## Linear-HDR accuracy and repeatability

Seed7 against the SAME common reference:

| Resolution | Sampler | Signed energy drift | RGB RMSE | p99 local RGB error |
| --- | --- | ---: | ---: | ---: |
| 1080p | independent-random | -0.021% | 0.107635 | 0.435613 |
| 1080p | fixed-pattern | -3.191% | 0.066334 | 0.220650 |
| 4K | independent-random | -0.011% | 0.108675 | 0.436815 |
| 4K | fixed-pattern | -3.175% | 0.066407 | 0.221362 |

Fixed-pattern per-tier energy drift against the common reference:

| Resolution | 32 SPP | 16 SPP | 8 SPP | 4 SPP | 2 SPP | 1 SPP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1080p | -5.045% | -5.978% | -7.205% | -2.187% | -1.942% | -0.518% |
| 4K | -5.008% | -5.988% | -7.201% | -2.196% | -1.941% | -0.463% |

The predeclared1% reduced-ring screen fails without changing its tolerance.
Fixed-pattern uniform32 is itself about3.6% below the common reference, so
the defect is not just adaptive tiering or unequal normalization.
All three fixed-pattern radial HDR hashes are identical at each resolution;
static frame-difference RMSE is exactly zero. This is not motion stability or
proof of accuracy. Random controls retain changing grain. Visual inspection
confirms structured lighting defects despite the candidate's lower error metrics.

Adaptive uniform32 is bit-identical to its fixed32 counterpart for both samplers
at both resolutions. Every pixel's actual count equals its requested budget.

## Work and memory

Seed7 radial diagnostics; GPU spans are separate instrumented tile sums, not
the above timing frames and not the complete job:

| Resolution | Primary rays, both | Random total segments | Fixed total segments | GPU tile spans, random / fixed ms |
| --- | ---: | ---: | ---: | ---: |
| 1080p | 12337920 | 29625602 | 29069027 | 4522.97 / 2443.64 |
| 4K | 49351680 | 118509874 | 116266527 | 15613.89 / 7256.47 |

Only about1.9% fewer total segments accompany45–52% shorter radial job times.
This suggests reduced per-segment/execution overhead and/or better coherence,
but no hardware occupancy/cache profile proves the split.

Sampler allocation inventories are identical. At1080p/4K respectively:
renderer buffers184339868/190483868 bytes; adaptive9421084/34304284;
telemetry8256; staging589824; cached host budgets18662400/74649600.
Texture descriptors are retained in the verification record. These are
application-visible allocations, not exact physical VRAM. The fixture allocates
adaptive resources for both comparison lanes; it does not qualify production
disabled-path memory. Diagnostic HDR arrays/PNG retention are additional host
memory outside these renderer allocation totals.

## Provenance and evidence

Capture: `native-fixed-pattern-2026-09-27T18-33-06-548Z-3d290b54-b8f6-43de-a8f2-8907bb3fcf79`.

- Renderer: [12f17c7ca574889fca95fc67e480ba366eafa8ad](https://github.com/Plasius-LTD/gpu-renderer/tree/12f17c7ca574889fca95fc67e480ba366eafa8ad).
- Lighting: [bf6308dee4f9be70f7f3619d5f668610a8be0439](https://github.com/Plasius-LTD/gpu-lighting/tree/bf6308dee4f9be70f7f3619d5f668610a8be0439).
- Shared: [729f89c7f77fcadb9ee7eeca53fb6daf02865b8e](https://github.com/Plasius-LTD/gpu-shared/tree/729f89c7f77fcadb9ee7eeca53fb6daf02865b8e).
- Asset source: [21d43a9b63722f1ce69175a5a42b53304ee79102](https://github.com/Plasius-LTD/plasius-ltd-site/tree/21d43a9b63722f1ce69175a5a42b53304ee79102).

Physical non-fallback Apple/Metal3 adapter; user's M2 Max host. Browser UA reports
Chrome153.0.0.0; exact build, power and thermal provenance are not qualified.
Source is served from immutable Git objects; seven original asset hashes checked.

[Verification record](fixed-pattern-2026-09-27-verification.json) rechecks raw HDR
chunk hashes/reconstruction, common-reference arithmetic, native PNG sizes,
all image metrics, seed identity, actual counts, ray counters, raw GPU timestamp
spans, timing means, source pins and sampler memory equality.
Physical CPU/GPU sampling parity covers17408 words:17 events x8 bounces x32
ordinals, including returned float values. Accepted capture reports no validation
errors, overflow, timeout or device loss.

The [artifact manifest](fixed-pattern-2026-09-27-artifacts.json) distinguishes the
portable review bundle (native images, raw receipts and source identifiers)
from full float-HDR chunks retained in the workspace capture directory
`output/playwright/eames-environments/<capture-id>`. Raw HDR chunks are not
included in the Git review bundle; externally portable publication evidence
requires their separate archival delivery. Do not describe that bundle alone
as sufficient to independently recompute HDR errors.

## Validation and remaining work

315 renderer tests (96.06% line coverage),148 lighting tests (80.66%), changed
source LCOV, lint, type checks, clean packed renderer type consumer, builds,
package checks, runtime audits and touched-package Zero-Three gates pass.
Source CI: renderer [36341061112](https://github.com/Plasius-LTD/gpu-renderer/actions/runs/36341061112),
lighting [36341227565](https://github.com/Plasius-LTD/gpu-lighting/actions/runs/36341227565).
README/CHANGELOG/design/ADRs document default-off operation and limits.
Run, stop and restart were exercised through the browser controls in separate
cancelled runs, excluded from the accepted measurements. Native images and the
initial desktop layout were visually inspected. Both image defects and numerical
gate failures remain visible; no visual-quality signoff is claimed.

Next qualification work is independent camera-only and dimension-decorrelated
fixed-lighting controls, independently converged references, other scenes and
moving-camera tests, followed by matched-quality timings. No brightness
multiplier, relaxed thresholds, public rollout, package publication or white-paper
improvement claim is justified by this run.
