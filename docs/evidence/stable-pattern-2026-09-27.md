# Stable-pattern correction — 27 September 2026

Status: **1080p and 4K brightness correction independently verified; no
matched-quality performance or production-primary promotion**.
Tasks renderer#169 / lighting#87; Feature site#2114. All sampler rollout flags remain off.

## Decision

Updated 28 September: the [fast-path restoration](fast-pattern-restoration-2026-09-28.md)
supersedes the working-direction choice below. Stable-pattern is retained as a
comparison, not an accepted replacement. Earlier visual claims of absent bands
were too broad: visible tier transitions remain and whole-ring means do not
establish local brightness/contrast or noise quality. Historical measurements
below remain unchanged.

The fixed pattern's brightness defect can be corrected while retaining pixel-centre
first camera samples and identical static frames. The correction does NOT retain
the defective pattern's speed advantage. It is a stable experimental candidate,
not an established quality/performance winner or the new production default.
Use stable-pattern as the primary experimental fixed-camera optimization lane,
with independent-random retained as its accuracy/performance control. This is
a work-direction choice, not qualification or production promotion.

The correction replaces identical lighting decisions across all pixels with
pixel/event/bounce/component-keyed fast permutations of the existing Sobol pair.
Keys exclude frame, seed, sample ordinal and budget. It preserves the same fixed
camera sequence, with its first sample at the centre. This is a pixel-local
scrambled pair, not a full multidimensional Sobol construction or full nested
Owen scrambling. No buffers, passes, caches or material-transport changes were added.

Flag: `renderer.sampling.stablePattern.enabled`, default false, mutually
exclusive with the existing sampler flags. Recreate the renderer when changing
the selection. All sampler flags off returns the exact historical GPU-native
source. The old defective fixedPattern remains an immutable comparison control.

## Protocol

Original Eames model: 265468 source triangles, five original 1024-square textures,
canonical shared Product Studio room/camera/lighting; submitted 265476 triangles.
Native 1920x1080 and 3840x2160, four-bounce ceiling, denoise off, maximum/sequence period 32.
Unchanged circular area shares 5/10/15/20/25/25% at 32/16/8/4/2/1 SPP, mean 5.95.
No temporal radiance reuse, resolution scaling, motion or frame-budget reduction.
This is renderer-fixture execution, not complete GPU-tab/application qualification.
Budgets are prescribed diagnostic rings, not the production conservative
importance classifier. Material/edge protection is not claimed by this capture.

Four controls: independent-random, old shared fixed-pattern, stable-camera-random
(fixed camera plus independent lighting held at frame zero), and stable-pattern.
The last three share camera samples. The camera/random control uses new dedicated
1D selectors as well as 2D lighting, so it is not a pure camera-only difference
from the historical independent-random implementation. Do not infer isolated
camera or compiler costs from that comparison.

One warmup and three rotated timing-only frames per sampler/mode; diagnostics
separate. 54 completed frames per resolution: 8 warmups, 24 timing, 22 diagnostics.
Three random fixed32 reference seeds 7/19/43 form a common 96-sample mean.
This reference is not certified converged and shares samples with the random
control. It cannot establish an unbiased true-error ranking.
The 1% brightness limits were frozen before the run and remain unchanged.

## Native 1080p results

Completed renderer-job milliseconds, excluding setup and diagnostic capture:

| Sampler | Uniform 32 | Adaptive 5.95 | Signed energy drift, adaptive |
| --- | ---: | ---: | ---: |
| Independent-random | 17181.07 | 5197.27 | -0.02092% |
| Old shared fixed-pattern | 7138.97 | 2962.83 | -3.19061% |
| Fixed-camera/random-lighting control | 17017.40 | 5230.93 | -0.03030% |
| Corrected stable-pattern | 17095.73 | 5226.73 | -0.01716% |

The stable candidate is 0.57% slower than the random control in these short means,
within an unqualified timing comparison; no speedup or confidence-bound claim.
It is 76.41% slower than the defective shared pattern. The old speed benefit is
not preserved. Compared with its own uniform32 run, reduced budgets shorten jobs
by 69.43%, but this is NOT matched image quality and not sampler-specific speedup.
All times are seconds when converted, far from the 16.67 ms real-time target.

Stable-pattern regional energy drift, 32/16/8/4/2/1 SPP:
-0.04233%, -0.03658%, -0.05464%, -0.01378%, +0.03250%, -0.02738%.
Worst reduced-ring magnitude falls from 7.205% to 0.05464%.
Both new controls pass global and per-ring brightness screens. The old shared
pattern fails. All three static seeds for each stable control are bit-identical.
Adaptive uniform32 matches each sampler's fixed32 exactly. Counts match every budget.

Visual inspection: the large angular lighting patches and dark circular bands
are absent in the corrected image. Visible low-SPP grain and changes in noise
density across the tier boundaries remain. This is NOT a clean 1-SPP image.
RGB RMSE / p99 local error against the common reference:
random 0.107635 / 0.435613; old pattern 0.066334 / 0.220650;
camera/random 0.110517 / 0.443205; stable 0.108751 / 0.438227.
Low aggregate error did not make the old structured image acceptable. The new
candidate also does not demonstrate superior reconstruction over random.

## Native 4K results

Completed renderer-job milliseconds from three rotated timing-only rounds:

| Sampler | Uniform 32 | Adaptive 5.95 | Signed energy drift, adaptive |
| --- | ---: | ---: | ---: |
| Independent-random | 63400.13 | 17658.67 | -0.01098% |
| Old shared fixed-pattern | 22747.80 | 8776.00 | -3.17532% |
| Fixed-camera/random-lighting control | 62612.23 | 17674.67 | -0.00486% |
| Corrected stable-pattern | 63229.50 | 17777.60 | -0.00362% |

The stable candidate is 0.67% slower than random in these short means and
102.57% slower than the defective pattern. No matched-quality speedup follows.
Stable-pattern regional drift at 32/16/8/4/2/1 SPP is -0.01018%, -0.00778%,
+0.00865%, +0.00355%, -0.01413%, -0.00924%. Worst reduced-ring magnitude falls
from 7.20112% to 0.01413%. Both new controls pass the unchanged brightness
screen, are bit-identical across all three static seeds, and pass uniform32
identity. The old pattern remains repeatable but fails brightness.

Visual inspection shows the same outcome as 1080p: no large angular lighting
patches or dark bands, but low-SPP grain/noise-density transitions remain.
RGB RMSE / p99 local error: random 0.108675 / 0.436815;
old pattern 0.066407 / 0.221362; camera/random 0.110268 / 0.444604;
stable 0.109182 / 0.439268. These are comparisons with the same limited reference,
not evidence that stable-pattern outperforms random in reconstruction quality.

## Work attribution and allocations

Seed-7 adaptive diagnostics:

| Sampler | Primary rays | Total segments | GPU tile-span sum ms |
| --- | ---: | ---: | ---: |
| Independent-random | 12337920 | 29625602 | 4496.29 |
| Old fixed-pattern | 12337920 | 29069027 | 2491.61 |
| Camera/random | 12337920 | 29626625 | 4421.78 |
| Stable-pattern | 12337920 | 29624754 | 4451.93 |

All four diagnostic modes have 7394 compute passes, 15586 total dispatches and
136 submissions. The correction's cost is not extra scheduler passes or rays
versus random. CPU command encoding spans 25.9–45.5 ms in these separate
instrumented frames, while GPU spans are multi-second. Waits yield JavaScript;
they are not CPU busy time. Do not subtract spans from unrelated timing frames.

The old sampler's coherent, correlated ray choices may explain its lower
execution cost, but no occupancy/cache/traversal-counter capture isolates the
cause. Dedicated shader source and the fixed-camera/random-lighting control
did not recover it; that control does not isolate camera cost alone.

At 4K every radial control completes 49351680 primary samples. Total segments
are 118509874 / 116266527 / 118501883 / 118497211 for random / old fixed /
camera-random / stable. Their diagnostic GPU tile spans are respectively
15125.05 / 7101.94 / 14999.36 / 15164.05 ms. Each uses 25440 compute passes,
54096 dispatches and 511 submissions. Host command encoding spans 83.0–108.2 ms.
Again, these are separate instrumented frames, not decompositions of the
timing-only means. The corrected candidate's large difference from old fixed
is visible on the GPU, without additional passes or allocations.

All sampler allocation inventories match: at 1080p renderer buffers 184339868,
adaptive buffers 9421084, telemetry 8256, staging 589824, cached host budgets
18662400 bytes. Textures are separately inventoried. No memory saving is claimed.
These are application-visible bytes, not exact physical VRAM residency.
At 4K, the inventories report renderer buffers 190483868, adaptive buffers
34304284, telemetry 8256, staging 589824 and cached host budgets 74649600 bytes.

## Provenance and retained evidence

- Renderer [e390a2a4ce6f4f76af1457a642bf7b62ca20082a](https://github.com/Plasius-LTD/gpu-renderer/tree/e390a2a4ce6f4f76af1457a642bf7b62ca20082a).
- Lighting [85d72cf4422cd689b742f9a4617d4b166bc3aa54](https://github.com/Plasius-LTD/gpu-lighting/tree/85d72cf4422cd689b742f9a4617d4b166bc3aa54).
- Shared 729f89c7f77fcadb9ee7eeca53fb6daf02865b8e.
- Site assets 21d43a9b63722f1ce69175a5a42b53304ee79102.

1080p capture: `native-stable-pattern-2026-09-27T19-25-35-346Z-9ac4ba37-64af-4a1b-aaa7-4f876bcb249d`.
4K capture: `native-stable-pattern-2026-09-27T19-37-56-866Z-d7f89a83-25f8-4f80-8ad4-3245ee5bb80f`.
Immutable Git-object serving and original asset hashes were checked.
Physical non-fallback Apple/Metal adapter; [sanitized host observation](stable-pattern-2026-09-27-host.json)
reports M2 Max, 32 GB, macOS 26.6.2, AC power and no recorded thermal warning.
That is a point-in-time observation, not temperature/clock monitoring.
Browser UA is retained; exact browser build qualification remains open.

[Independent 1080p verification](stable-pattern-1080p-2026-09-27-verification.json)
and [independent 4K verification](stable-pattern-4k-2026-09-27-verification.json)
reconstruct every retained HDR image, validate chunk/image hashes and native
PNG dimensions, recompute common-reference arithmetic and all image metrics,
sample counts, raw GPU timestamp spans, timing means, repeatability and memory.
Physical CPU/GPU parity covers 8704 words, 17 events, 8 bounces, high ordinals
through u32 maximum and both new modes. No accepted-run validation error,
overflow, timeout or device loss occurred.

[1080p review bundles and raw-data inventory](stable-pattern-1080p-2026-09-27-artifacts.json)
and [4K review bundles and raw-data inventory](stable-pattern-4k-2026-09-27-artifacts.json):
native PNGs and raw receipts are committed; full float HDR chunks remain local.
The review bundles alone do not allow independent HDR-error recomputation;
portable publication requires separate archival delivery of the full chunks.
The old fixed and random seed-7 fixed/radial image hashes also match their
previous experiment exactly at both resolutions; the comparison controls did
not silently change with the new sampler.

## Validation and remaining gates

319 renderer tests / 96.08% line coverage; 149 lighting tests / 80.67%.
Changed runtime files appear in LCOV. Requirements-first failures were recorded.
Lint, type checks, clean packed type consumer, build, package checks,
runtime audit and all touched-package Zero-Three surfaces pass.
Renderer [source CI](https://github.com/Plasius-LTD/gpu-renderer/actions/runs/36344240636)
and lighting [source CI](https://github.com/Plasius-LTD/gpu-lighting/actions/runs/36344276232)
succeeded. README, CHANGELOG, design and ADRs describe default-off operation.

Run, resolution selection, stop and restart were exercised through the UI.
The deliberately cancelled attempt
`native-stable-pattern-2026-09-27T19-37-36-400Z-f254069a-30fe-4026-b556-25116b5bcc27`
is retained and excluded; its generic "cancelled or device lost" error was
triggered by the Stop control, not an observed device-loss event.

The source audit identifies possible next work, NOT measured optimizations:
BVH bounds testing recomputes direction reciprocals per node; traversal pushes
children in fixed order rather than distance order; triangle intersections
interpolate normals/UVs before comparison with the nearest distance.
These require separate tracked, flagged tests and tie/identity checks, not
unreviewed transport changes or a promised speedup.

Moving-camera/focus sequences, converged independent references, full scenes/
materials/depth matrix, local/silhouette quality, sustained timing confidence,
GPU-tab integration and release gates remain open. No production default,
package publication, white-paper improvement claim or Three.js fallback.
