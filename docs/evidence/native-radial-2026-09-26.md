# Native radial adaptive trace — 26 September 2026

**Outcome: the requested native adaptive distribution runs and its completed
counts are verified at both resolutions. It does not meet 60 Hz or establish
matched-quality performance.** The simple scene shows visible noise and brightness
boundaries at reduced-sample rings. No white-paper performance or memory-saving
claim is approved.

Tracked by [renderer#169](https://github.com/Plasius-LTD/gpu-renderer/issues/169),
[lighting#87](https://github.com/Plasius-LTD/gpu-lighting/issues/87), and
[Feature site#2114](https://github.com/Plasius-LTD/plasius-ltd-site/issues/2114).
The [prescribed trace protocol](../native-radial-adaptive-trace.md) and
[native acceptance contract](../native-resolution-acceptance.md) distinguish the
fixed reference from the adaptive real-time target. Flags remain default off;
Three.js is prohibited without fallback.

## Immutable capture and method

Final capture: `native-radial-2026-09-26T12-15-45-654Z`,
status `traced-not-qualified`, empty failed-lane list.

- Renderer [b9a3df2e938b098148d3341274fed5d1ebd82ec8](https://github.com/Plasius-LTD/gpu-renderer/commit/b9a3df2e938b098148d3341274fed5d1ebd82ec8);
  lighting [72e4815ae4402212c3f121e01aadfca688b9c79d](https://github.com/Plasius-LTD/gpu-lighting/commit/72e4815ae4402212c3f121e01aadfca688b9c79d).
  Server reads immutable Git objects; ten served module hashes are retained.
- Physical Apple M2 Max MacBook Pro, 32 GB unified memory; browser reports Apple
  metal-3, non-fallback. Foreground/visible at every recorded frame boundary.
  Browser build, power/thermal state and physical display cadence are not
  captured, so these are not controlled sustained measurements.
- Actual renderer, canvas, PNG and HDR dimensions: 1920×1080 and 3840×2160.
  All 135/510 tiles execute; no small-view extrapolation or upscaling.
- Lighting-owned `diffuse-silhouette`: six triangles, including a diffuse panel,
  metal panel and thin emissive bar, with procedural environment. Not Eames or
  the Product Studio scene; mostly smooth environment in the low-SPP perimeter.
- Fixed camera/seed 7, four-bounce ceiling, sequence period/maximum 32, denoise off.
  No frame-budget reduction, motion/history policies or temporal radiance reuse.
  Fixed32 uses the existing dispatcher. Adaptive uses ordinary shared-round
  scheduling and unchanged material transport. Optional fused-hit variant is
  **off** after the failed identity control described below.
- Timing-only: one warmup and three measured frames per mode/resolution, alternating
  fixed/radial order. CPU profiler and diagnostic ray/HDR readbacks are off.
  Complete job includes frame-state uploads, every tile, compaction, transport,
  count resolve, GPU presentation and queue completion. Compilation/map setup,
  artifact retention, application work and physical display delivery are excluded.
- Separate fixed32, uniform32 adaptive and radial diagnostic frames collect
  host stages, per-tile timestamps/active queues and linear float32 images.
  Every adaptive pixel's requested/completed count is checked on GPU readback.
  Retained artifacts contain verified histograms/assertion outcomes, not raw
  packed per-pixel count words. Both ordinary uniform32 controls are bit-identical
  to fixed32, including identical primary/secondary ray counts.

## Exact circular pixel-area prescription

Euclidean pixel-centre distances, not normalized UV distances, keep the bands
circular. Rectangular viewport edges clip the outer circles. Equal-distance
boundary ties use row-major pixel ID to obtain exact area shares.

| Centre outward | Screen area | 1080p pixels | 4K pixels |
| --- | ---: | ---: | ---: |
| 32 SPP | 5% | 103,680 | 414,720 |
| 16 SPP | 10% | 207,360 | 829,440 |
| 8 SPP | 15% | 311,040 | 1,244,160 |
| 4 SPP | 20% | 414,720 | 1,658,880 |
| 2 SPP | 25% | 518,400 | 2,073,600 |
| 1 SPP | 25% | 518,400 | 2,073,600 |

Requested and actual mean: **5.95 SPP**; **81.40625% fewer primary camera samples**.
Budgets are selected before samples and cached per configuration. A fresh frame
resets completed counts; cache reuse does not reuse rays, samples or radiance.
Absolute sample ordinals continue across tier ranges within that frame.

## Timing-only results

| Metric | 1080p fixed32 | 1080p radial | 4K fixed32 | 4K radial |
| --- | ---: | ---: | ---: | ---: |
| Mean complete job (ms) | 2,281.60 | **722.93** | 8,904.07 | **2,996.97** |
| Raw measured jobs (ms) | 2307.3 / 2241.1 / 2296.4 | 727.0 / 707.6 / 734.2 | 8961.5 / 9037.3 / 8713.4 | 3045.8 / 3089.2 / 2855.9 |
| p99 / maximum (ms) | 2,307.30 | 734.20 | 9,037.30 | 3,089.20 |
| Missed 16.6667 ms deadline | 3/3 | 3/3 | 3/3 | 3/3 |

Observed reduction in the ratio of means: **68.31% (3.156×)** at 1080p and
**66.34% (2.971×)** at 4K. These compare lower sample counts, not matched image
quality. Three observations cannot establish reliable tail behaviour; p99 is
just the maximum. Reciprocal mean adaptive job times are upper-bound renderer
throughputs of 1.38 and 0.334 frames/s, not measured display FPS. Neither
configuration is near the real-time milestone. Do not pool these timings with
older native or 128×128 captures.

## Diagnostic work and attribution

These are separate instrumented frames, not the timing-only averages above.
Timestamp sums span each tile's compute-to-output interval, excluding uploads and
final presentation. They are not one complete-job GPU timestamp.

| Metric | 1080p fixed32 | 1080p radial | 4K fixed32 | 4K radial |
| --- | ---: | ---: | ---: | ---: |
| Actual primary rays | 66,355,200 | **12,337,920** | 265,420,800 | **49,351,680** |
| Actual secondary rays | 13,651,676 | 6,451,357 | 54,629,768 | 25,797,551 |
| Total active-queue path segments | 80,006,876 | 18,789,277 | 320,050,568 | 75,149,231 |
| Summed GPU tile time (ms) | 1,471.68 | 503.51 | 5,895.95 | 1,843.86 |
| Tile sample rounds | 4,320 | 1,024 | 16,320 | 3,582 |
| Compute passes | 25,920 | 7,394 | 97,920 | 25,440 |
| Direct dispatches | 25,920 | 5,101 | 97,920 | 17,544 |
| Indirect dispatches | 34,560 | 10,485 | 130,560 | 36,552 |
| Submissions / queue waits | 136 | 136 | 511 | 511 |

Path segments count active camera/continuation queues, not all NEE shadow
traversals or BVH tests. Diagnostic count-gather dispatches are included in these
command totals and absent from timing-only execution.

| Radial exclusive host stage (ms) | 1080p | 4K |
| --- | ---: | ---: |
| Configuration packing | 3.40 | 8.30 |
| Upload API calls | 0.60 | 3.30 |
| Command encoding | 16.00 | 56.60 |
| Finish + submit | 1.40 | 2.60 |
| **Sum of measured synchronous stages** | **21.40** | **70.80** |
| Asynchronous GPU completion waits | 770.40 | 2,812.50 |
| Diagnostic telemetry readback waits | 91.00 | 304.00 |
| Diagnostic HDR/count readback waits | 166.80 | 632.10 |

Waits are elapsed asynchronous spans, not CPU busy time or a guarantee of idle
CPU availability. Subtracting GPU timestamps from waits does not identify CPU
work. The shared tile buffers still serialize submission/completion per tile.
This is an investigation target, not proof that batching alone can meet 60 Hz:
measured GPU work itself greatly exceeds the frame budget. Profile transport,
dispatch overhead and safe multi-tile batching independently before a new claim.

## Image quality — not yet accepted

| Radial minus fixed32, linear HDR | 1080p | 4K |
| --- | ---: | ---: |
| RGB RMSE | 0.0602762 | 0.0601770 |
| Normalized RMSE | 0.0673957 | 0.0672867 |
| Maximum absolute channel error | 1.72252 | 1.87205 |
| p95 local maximum channel error | 0.287034 | 0.286498 |
| p99 local maximum channel error | 0.467985 | 0.467425 |
| Mean absolute luminance error | 0.00803814 | 0.00801047 |
| Global scene-energy difference | +0.9693% | +0.9709% |

The central 32-SPP region is exact. The 16-SPP ring is about **4.464% brighter**
and the 8-SPP ring about **3.89% brighter** than the corresponding fixed32 region.
This is visible as a circular brightness boundary in the diffuse panel, as well
as increased noise. The outer 1/2-SPP rings mostly cover smooth environment and
differ very little, which makes the global metric look better than local geometry.
The cause of the reduced-prefix brightness difference is not diagnosed by this
capture. Do not call it harmless noise or proof of an unbiased estimator.

No native converged 128/256-SPP reference, multi-seed/focus/motion sequence,
silhouette mask or full benchmark matrix was captured. Frozen quality limits
were not relaxed and a matched-quality timing-confidence gate was not evaluated.
The radial prescription intentionally isolates scheduling; it is not the
production conservative material/coverage classifier policy.

## Memory and one-time setup

Application-visible requested allocations, **not physical VRAM residency**:

| Bytes / cost | 1080p | 4K |
| --- | ---: | ---: |
| Renderer hot buffers | 15,086,180 | 21,230,180 |
| Adaptive buffers | 9,421,084 | 34,304,284 |
| Textures, calculated from retained descriptors | 41,603,716 | 166,019,716 |
| Telemetry buffers | 8,256 | 8,256 |
| Diagnostic staging buffers | 589,824 | 589,824 |
| Cached budget typed arrays on host | 18,662,400 | 74,649,600 |
| Map construction (ms, once) | 23.60 | 61.10 |
| Tile-plan construction (ms, once) | 28.70 | 108.30 |

Adaptive allocation is below its 128 MiB cap. Counts reset and budgets upload
each frame; this work is included in job timing. Cached host arrays include the
fixture's radial and uniform-control words. Float32 image retention adds
33,177,600 / 132,710,400 bytes per full image, with further compression/metric
scratch and JS object overhead; it occurs outside the timing-only jobs. These
categories are not a measured total heap/peak allocation or complete driver
memory accounting. Fixed and adaptive lanes share the fixture's allocation
owner, so this capture does not demonstrate disabled-state allocation absence
or a memory saving.

## Failed attempts and optional hit fusion

Retain, do not pool:

1. `native-radial-2026-09-26T12-03-20-234Z` (renderer `f4556b5`,
   lighting `68629da`): 4K HDR retention failed after 1080p completed. Receipt
   records “Trace retention failed”, not an HTTP-size diagnosis. Large whole-image
   payloads were replaced by lossless bounded chunks without raising the bridge's
   existing 64 MiB limit.
2. `native-radial-2026-09-26T12-08-38-718Z` (renderer `3af4f2e`,
   lighting `72e4815`): chunk retention worked; 4K fused uniform32 identity failed.
   This runner stopped before retaining the mismatching image.
3. `native-radial-2026-09-26T12-12-32-089Z` (renderer
   `614ef71cbc6e0eae5201987ec3ec40f5fff1d661`, lighting `72e4815`):
   independently retained ordinary and fused uniform32 controls. Ordinary is
   bit-identical. Fused differs in **four pixels / 12 RGB words**, maximum
   absolute error **0.08680737018585205**, despite equal counts and global
   energy drift of only 9.3e-9. This fails the existing 1e-5 identity limit.

The final ordinary-transport capture passes both native identity controls.
Fused-hit optimisation remains unqualified; native tracing explicitly disables
it. Root cause is open. The tiny affected area is not a waiver.

## Retention, independent verification and replay

- [1080p raw traces, PNGs, float32 chunks and combined summary](native-radial-1080p-2026-09-26.tar.gz),
  SHA-256 `37b68a0071b85ec242275fb6a01b6ef569e8dd1fd755c3028849bdd19cd6c0e9`.
- [4K raw traces, PNGs and float32 chunks](native-radial-4k-2026-09-26.tar.gz),
  SHA-256 `aa94e961537ac10c0acb77b81d39b374d95e9c39238e7bd2b86d98b228b4ffed`.
- [Rejected receipts and fused-control metadata/PNG](native-radial-rejected-2026-09-26.tar.gz),
  SHA-256 `a4f9c6fc7c27906916124a6ea892c7fab89f7ea6daffbf4c54ead623e2c3cb98`.
- [Independent verification and exact fused-image delta](native-radial-2026-09-26-verification.json).

All ten source hashes were checked against their Git objects. Independent replay
regenerated both budget maps/histograms, checked native PNG dimensions, visibility,
timing means, tile/ray sums, raw timestamps and lossless image/chunk hashes, and
recomputed full-frame HDR differences. The unchanged uniform controls are
byte-identical. No raw timing or original rejected evidence was edited.

For each image manifest, follow each chunk's artifact basename to its JSON.
Decode base64 and gunzip to byte planes; for a chunk of N bytes, restore
`raw[4*i+plane] = shuffled[plane*(N/4)+i]`. Check the chunk SHA-256, concatenate
contiguous byte offsets, then check the complete image hash before interpreting
little-endian RGBA float32. An identical uniform image references its fixed
manifest. Chunk-marker PNGs are not renderer output; use the native
`1080p-fixed/radial.png` and `4k-fixed/radial.png`, plus `*-budget.png`.
Summary/trace PNGs may be after resource teardown; they are not image evidence.

The failed fused 4K image can be exactly reconstructed from final `4k-fixed`
(the failed run's fixed image has the same hash) using the verification JSON's
12 changed uint32 words, checking each before value and the final candidate hash.
This preserves the complete failing image losslessly without duplicating 4K HDR
in Git. Full original captures, including rejected HDR chunks, remain local.

To recapture, serve the pinned renderer paths `/src/`, `/tests/fixtures/`,
the pinned lighting demo/scripts under `/lighting/`, the existing bounded local
capture bridge, and immutable `/__provenance`. Open
`/tests/fixtures/native-adaptive-trace.html` with physical WebGPU and run.
Use fresh capture IDs; keep failed attempts and do not substitute the old
single-tile fixture.

Local validation: renderer 302 tests / 96.01% line coverage, lighting 136 tests /
80.42%. New tile-plan/output and radial/chunk modules have 100% lines/branches
and are present in LCOV. Lint, type/syntax, build, public-package and all nine
Zero-Three checks pass in both packages; production-dependency audits report no
vulnerabilities. New tests were run failing before implementation where practical.
Physical shader assembly/device execution, full-count/identity and evidence
replay pass for ordinary transport. CI/review and applicable main/CD remain
separate delivery gates. Tasks stay open; no site activation, release or paper
edition was performed.

