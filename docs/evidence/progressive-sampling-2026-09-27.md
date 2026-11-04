# Progressive sampling experiment — 27 September 2026

Status: **brightness-band diagnostic passes at 1080p; no image-quality,
matched-quality performance, real-time or production qualification**.
Tasks gpu-renderer#169 / gpu-lighting#87; Feature site#2114.
Both new sampler flags and public adaptive rollout remain off.

## Question and answer

The legacy 2D sampler computes x=(sampleOrdinal+jitter)/maximumSPP.
With a 32-sample ceiling, the first eight samples explore only [0,0.25)
in this dimension, including diffuse/GGX azimuth and camera jitter.
That is incomplete domain coverage, not merely too few noisy samples.

Owen–Sobol removes the measured regional brightness error. Independent random
sampling does too: **full-domain progressive prefixes are the causal correction;
Sobol is not uniquely necessary to remove these bands**. Neither correction
removes visible one/two-SPP noise or establishes a performance improvement.

The experiment changes only 2D sampling. Keep all 1D selectors, BSDF/PDF/MIS,
unweighted complete-path sum/count normalization, material transport, scene,
lighting, budgets and denoising unchanged. No brightness multiplier or blending.

## Controls and provenance

Capture: native-sampler-2026-09-27T16-57-43-720Z.

- Renderer [82bbd72a1b7af133cf05bc6a9d654ad96ded6811](https://github.com/Plasius-LTD/gpu-renderer/tree/82bbd72a1b7af133cf05bc6a9d654ad96ded6811).
- Lighting [c21b08d76a3320a952259363cde487c8911d9da0](https://github.com/Plasius-LTD/gpu-lighting/tree/c21b08d76a3320a952259363cde487c8911d9da0).
- Shared [729f89c7f77fcadb9ee7eeca53fb6daf02865b8e](https://github.com/Plasius-LTD/gpu-shared/tree/729f89c7f77fcadb9ee7eeca53fb6daf02865b8e).
- Site assets [21d43a9b63722f1ce69175a5a42b53304ee79102](https://github.com/Plasius-LTD/plasius-ltd-site/tree/21d43a9b63722f1ce69175a5a42b53304ee79102).

Immutable Git-object server, original 265,468-triangle Eames model, five original
1024-square textures, canonical shared Product Studio room/camera and procedural
studio lighting. Submitted total 265,476 triangles; 137,735 BVH nodes.
Physical Apple/Metal-3 adapter on the user's M2 Max MacBook Pro. No proxy geometry,
resolution reduction, automatic frame budget, motion scaling or temporal reuse.
This is the full-source renderer fixture, not the complete site application.
Browser build/user-agent provenance is not retained; publication remains blocked.

Native 1920×1080, four-bounce ceiling, maximum/sequence period32, denoise off.
Exact centred area shares 5/10/15/20/25/25% at 32/16/8/4/2/1 SPP (mean5.95).
Seeds7/19/43, same-sampler fixed32 reference. Seed7 adaptive uniform32 is
bit-identical to corresponding fixed32 for all three samplers. Legacy seed7
fixed HDR SHA-256 matches the historical image exactly:
1a80ccffb35002018130e70a1b9b33d7b0869f91af7eb7248cd13ec1692ad211.
Physical GPU sampling probe matches 16,384 integer words to the exact CPU
reference. These are correctness checks, not small-resolution performance claims.

One warmup and three timing-only frames per sampler/mode, rotated order.
HDR/count/CPU/GPU diagnostics run separately. Sampler changes recreate a single
live renderer; recreation/setup is recorded outside completed-frame timings.
The [design and thresholds](../design/progressive-sampling-experiment.md) were
frozen before measurements; no criterion was relaxed after results.

## Brightness-band result

Mean signed regional luminance difference from the same-sampler fixed32 image,
averaged across three seeds (percent):

| Ring | Legacy | Independent random | Owen–Sobol |
| --- | ---: | ---: | ---: |
| 16 SPP | -9.7440% | -0.0141% | -0.0120% |
| 8 SPP | -1.9937% | -0.0175% | -0.0109% |
| 4 SPP | +2.4735% | +0.0153% | +0.0120% |
| 2 SPP | -3.0981% | -0.0126% | -0.0096% |
| 1 SPP | -6.4220% | +0.0223% | +0.0146% |

Both satisfy the predeclared <=1% absolute mean drift for every reduced ring
and >=80% reduction of the 16-SPP error. Observed reductions: random99.8557%,
Sobol99.8772%. Central32 pixels remain identical to each sampler's fixed32.
This strongly supports the diagnosed prefix-coverage cause on this workload;
it is not proof that all renderer estimators/materials are unbiased.

Noise remains. Seed7 normalized RGB RMSE against respective fixed32 references:
legacy0.122411, random0.125938, Sobol0.124993. These references differ and are
not converged, so this does not rank true reconstruction error or demonstrate
Sobol superiority. Local tails, signed energy and all seed results are retained.
Regional means must not substitute for silhouette, local or temporal quality.

## Timing and work

Completed renderer-job means, milliseconds, native1080p:

| Sampler | Fixed32 | Radial5.95 |
| --- | ---: | ---: |
| Legacy | 12,219.20 | 3,660.70 |
| Independent random | 16,445.53 | 5,082.40 |
| Owen–Sobol | 16,943.97 | 5,128.77 |

The Sobol radial candidate is about40.1% slower than legacy at identical primary
budgets. It is not a matched-quality comparison: legacy has brightness bias.
Neither new candidate demonstrates a net speedup. Three short measurements do
not establish the full confidence-bound gate or sustained display cadence.
All timings are far above the16.67ms target.

Seed7 radial primary rays are12,337,920 in every sampler. Total path segments:
legacy27,787,871; random29,625,602; Sobol29,625,583. Better coverage changes
which paths are followed; total path segments increase about6.6%. Separate
instrumented GPU tile spans are3,103.72 /4,393.14 /4,428.27ms respectively.
They exclude uploads/final presentation and must not be subtracted from other
frames' total times to manufacture an exact overhead figure.

The additional cost cannot all be attributed to Owen scrambling: random is also
slower. Shader code shape/occupancy and shared experimental branches are possible
contributors requiring targeted measurement; this experiment does not prove
the compiler cause. Future source specialization should be independently tested.

## Implementation and memory

Flags: renderer.sampling.owenSobol.enabled and
renderer.sampling.independentRandom.enabled, mutually exclusive, default false.
Existing remote-snapshot shapes are accepted. Flags are renderer-creation
snapshots; recreate to change them. Both off uses the exact original shader.

Pixel-local first-two-dimension Sobol with hash-driven nested binary Owen
permutations of24 bits; scramble keys exclude ordinal, budget and tier.
This is not a global image-space Sobol sampler or the approximate fast scramble.
See [PBRT's primary description](https://pbr-book.org/4ed/Sampling_and_Reconstruction/Sobol_Samplers).
No per-pixel sample cache, new buffers, textures or passes are added. The existing
frame flag word is reused and allocation sizes are unchanged. This is not an
exact physical VRAM-residency claim or a claim that fewer rays reduce memory.
The fixture itself allocates adaptive/diagnostic buffers even for fixed controls.

## Rejected attempts retained

- native-sampler-2026-09-27T16-45-50-676Z: CPU/GPU integer parity failed before
  Eames rendering. The new CPU reference had reused legacy floating multiplies
  that lose low integer bits. Fixed only the new reference with exact wrapping
  arithmetic and a BigInt regression; legacy CPU behavior remains unchanged.
- native-sampler-2026-09-27T16-47-28-205Z: dormant experimental WGSL changed
  the historical flag-off output hash. Rejected, including its timings.
  That attempt did not retain the failing HDR image; the subsequent dedicated
  preflight retains failures and ensures the old shader is selected byte-exactly.

The accepted run matches the old image. Do not combine rejected timings with
the accepted run or silently omit these implementation failures.

## Native4K follow-up

The same full Eames scene at3840×2160, seed7, Owen–Sobol: fixed32 mean
63,890.43ms; radial5.95 mean17,821.80ms. Corresponding separate GPU tile
spans56,647.81 /15,626.99ms. Actual primary rays265,420,800 /49,351,680;
total path segments554,765,122 /118,493,638. No comparison with earlier
legacy timings is used to claim a same-run4K sampler speed difference.

Uniform adaptive32 is bit-identical to Sobol fixed32. Reduced-SPP regional
energy differences are+0.00244%, -0.00997%, -0.00475%, -0.00892%, -0.00560%
for16/8/4/2/1 SPP respectively; scene energy-0.00631%.
Normalized RGB RMSE0.124690. Brightness continuity persists at4K; noise and
the real-time gap remain. One seed is a follow-up, not full4K qualification.

No GPU validation error, timeout or device loss was recorded. All completed
counts and primary-ray totals match, and adaptive cleanup returned to zero.
This short run is not sustained stability qualification.

## Retained evidence and independent verification

The [verification result](progressive-sampling-2026-09-27-verification.json)
reconstructs every retained seed7 HDR chunk and checks SHA-256, contiguous
offsets, native PNG dimensions, exact uniform32 identity, historical flag-off
identity, regenerated radial budgets, every diagnostic ray/tile sum and raw
timestamp span, timing means, seed7 global/regional errors, all-seed aggregate
criteria and equal allocation inventories across sampler recreations.

Raw HDR is retained for seed7 (including native4K); seeds19/43 retain images,
HDR hashes, counts and computed metrics, not full float arrays. Their regional
aggregates are recalculated from retained metrics, not independently from HDR.
Archives and hashes are listed in the accompanying artifact manifest.
Archives retain the two rejected attempts and the verification/server scripts.
Extract all parts into one directory; paths retain the capture ID. Reconstruct
HDR using the existing byte-plane/gzip chunk protocol and image manifests.
Use the fixed/radial PNGs, not the blank post-teardown summary or chunk markers.

Allocation inventory is unchanged across samplers: renderer buffers
184,339,868 /190,483,868 bytes (1080p/4K), adaptive buffers9,421,084 /34,304,284,
telemetry8,256, staging589,824. Cached host budget arrays18,662,400 /74,649,600.
Texture descriptors are retained separately; no physical residency assertion.

Local renderer311 tests/96.05% lines; lighting146 tests/80.61% lines.
Changed source files are represented in LCOV. Distribution/parity/control
regressions, lint, types, builds, public-package/privacy, full Zero-Three gates
and runtime dependency audits pass. Source-pinned renderer CI36335219474 and
lighting CI36335220221 succeeded. README, CHANGELOG, ADR and design are current.
Evidence-only delivery CI is checked separately after its push.

## Remaining qualification

No publication/performance promotion is authorized by this report.
The successful diagnostic still requires converged common references, full
scene/material/depth matrix, temporal checks, matched-quality confidence bounds,
performance optimization and applicable release gates before production.

## Downloadable artifact parts

[Archive manifest and SHA-256 hashes](progressive-sampling-2026-09-27-artifacts.json).

- [sampling-receipts-part1-2026-09-27.tar.gz](sampling-receipts-part1-2026-09-27.tar.gz) — 28.83 MiB.
- [sampling-receipts-part2-2026-09-27.tar.gz](sampling-receipts-part2-2026-09-27.tar.gz) — 17.61 MiB.
- [sampling-1080p-random-part1-2026-09-27.tar.gz](sampling-1080p-random-part1-2026-09-27.tar.gz) — 58.13 MiB.
- [sampling-1080p-legacy-part1-2026-09-27.tar.gz](sampling-1080p-legacy-part1-2026-09-27.tar.gz) — 56.80 MiB.
- [sampling-1080p-sobol-part1-2026-09-27.tar.gz](sampling-1080p-sobol-part1-2026-09-27.tar.gz) — 57.55 MiB.
- [sampling-4k-sobol-part1-2026-09-27.tar.gz](sampling-4k-sobol-part1-2026-09-27.tar.gz) — 60.07 MiB.
- [sampling-4k-sobol-part2-2026-09-27.tar.gz](sampling-4k-sobol-part2-2026-09-27.tar.gz) — 61.07 MiB.
- [sampling-4k-sobol-part3-2026-09-27.tar.gz](sampling-4k-sobol-part3-2026-09-27.tar.gz) — 51.01 MiB.
