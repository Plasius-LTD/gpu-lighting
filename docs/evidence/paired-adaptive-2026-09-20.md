# Before/after adaptive diagnostic — 20 September 2026

Tasks [gpu-lighting#87](https://github.com/Plasius-LTD/gpu-lighting/issues/87) and
[gpu-renderer#169](https://github.com/Plasius-LTD/gpu-renderer/issues/169), Feature
[site#2114](https://github.com/Plasius-LTD/plasius-ltd-site/issues/2114).

**Result: sample accounting passes this probe; matched-quality performance does
not. No adaptive speedup, memory saving, Eames noise fix or publication approval.**

## Controls and provenance

The [protocol](../paired-adaptive-probe.md), scenes and tolerances were committed
before measurements in lighting
[`e0f1389454b22eb8afdd0f5031e1b86ea3c8487e`](https://github.com/Plasius-LTD/gpu-lighting/commit/e0f1389454b22eb8afdd0f5031e1b86ea3c8487e).
The final renderer fixture is
[`c6d490a7bc8a04122a784f8146cb6e547d0c3902`](https://github.com/Plasius-LTD/gpu-renderer/commit/c6d490a7bc8a04122a784f8146cb6e547d0c3902).
Sources were served from immutable Git objects, not a mutable build. The physical
adapter reported Apple / metal-3, non-fallback, in the local Codex in-app browser.
This is one measured device/runtime, not cross-device qualification.

Each of two 128×128 scenes uses a stationary camera, four-bounce ceiling, seed 7,
denoise off, and fixed 128/256-SPP references. Compare corrected fixed32,
adaptive-uniform32 and **preassigned** concentric 2/8/32 budgets. These budgets are
not the production importance policy; risky surfaces are intentionally not
protected in this diagnostic. Motion/frame governors, history and temporal reuse
are absent. The sampling sequence period stays 32 in both comparison paths.
Both use the same corrected transport; this does not compare the old release with
a newly corrected transport or complete PR94's fixed-baseline recapture.

The fixed WGSL SHA-256 remains
`c0a78da83cb60ed59a1bc56ead48d7e258c01ce402836d464c5b713b24c38fcb`.
There are two warmups per mode and ten rotated measurement rounds per scene.
Repeated timings reuse the same deterministic image: they are not independent
sampling-error realizations. Two converging reference budgets are a diagnostic
check, not exact ground truth or production reference qualification.

## Before and after

Mean times below are milliseconds. GPU time brackets actual first/final compute
work, including worklist, bootstrap, material transport, completion and output.
The separate linear-output job includes host preparation/submission through queue
completion. Initial setup, readback, preview and canvas presentation are excluded.
Configuration uploads are outside the GPU timestamp interval but inside job time.
Diagnostic queue-counter copies are enabled in all modes; overhead is retained.

| Scene / mode | Actual primary rays | Actual wavefront path segments | GPU mean | Job mean | RGB RMSE vs fixed256 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Environment / fixed32 | 524,288 | 524,288 | 9.634 | 15.49 | 0.00004601 |
| Environment / adaptive32 | 524,288 | 524,288 | 12.163 | 20.21 | 0.00004601 |
| Environment / adaptive2/8/32 | 144,680 | 144,680 | 13.068 | 23.17 | 0.00013355 |
| Diffuse silhouette / fixed32 | 524,288 | 717,183 | 14.031 | 19.88 | 0.02661642 |
| Diffuse silhouette / adaptive32 | 524,288 | 717,183 | 17.164 | 25.33 | 0.02661642 |
| Diffuse silhouette / adaptive2/8/32 | 144,680 | 229,338 | 17.013 | 27.30 | 0.08977575 |

These are observed active-queue primary/secondary rays, not theoretical
width×height×SPP×depth or counts of every BVH/visibility test. The reduced lane
averages 8.830566 SPP: 72.4045% fewer primary rays, and 68.0224% fewer path segments
in the diffuse scene. Its actual bounce histogram is [144680, 84658, 0, 0]. A
four-bounce ceiling here does not exercise four material interactions.

Adaptive32 matches fixed32 bit-for-bit for all retained RGB pixels and repeated
image hashes in both scenes. Every pixel's completed count equals its requested
budget. This supports accounting and unchanged same-sequence transport in this
probe, not general visual qualification.

Reduced-budget error is 2.90× fixed error in the environment scene (small absolute
error) and 3.37× in the diffuse scene. The diffuse p99 local error rises from
0.186970 to 0.606639 and relative scene energy differs from reference by +1.77135%,
exceeding the frozen 1% limit. This single noisy frame does not prove transport
bias. Both reduced lanes fail the frozen RMSE/local-error tests. Reference128 vs
256 normalized RMSE is 0.001945% / 1.297368%, passing the provisional 3% criterion.
Visual inspection agrees: adaptive32 looks the same; reduced diffuse areas have
substantially more grain. PNG panels also retain error×4 and the budget overlay.

## Performance decision

No matched-quality improvement passes. Fixed GPU timing CV is high: 31.84% for
environment and 26.03% for diffuse. The rule max(5%, 2×CV) therefore requires
63.67% / 52.06% improvement in this diagnostic. The reduced lane's lower 95%
improvement bounds are **−65.17% / −58.53%**, from paired after/before ratios, so
even timing alone fails. Ratios of mean times and means of paired ratios differ;
the machine-readable evidence retains the chosen paired method and raw rounds.
These are not historical schema-1 variances or an accepted production baseline.

The implementation currently executes 42 tier/sample iterations for 2/8/32 versus
32 for fixed/uniform32, plus compaction, bootstrap and complete-count passes.
This is a concrete overhead source to investigate, not proof that it explains all
timing differences. Small workloads, timestamp granularity, host/runtime load and
high observed variance limit extrapolation. Do not turn ray savings into speedup
claims, or advertise these results as a universal adaptive regression.

## Allocations

Reported application-visible buffer allocations in this shared comparison fixture:

| Category | Bytes |
| --- | ---: |
| Base renderer buffers, environment / diffuse | 13,002,004 / 13,005,412 |
| Adaptive buffers, including worklists/configuration | 1,191,452 |
| Queue/timestamp telemetry buffers | 8,256 |
| Fixture copy/staging buffers | 524,288 |
| Nominal texture texel bytes, separately calculated | 459,396 |

The renderer is preallocated for the 256-SPP reference; this is not a minimum
fixed32 allocation. The shared runner allocates adaptive resources before all
lanes, including the fixed control: use this for timing/image comparison, **not**
disabled-mode allocation equivalence. No buffer is shrunk when fewer rays run.
Texture totals use the recorded dimensions/formats with one mip/sample; they
exclude implementation padding, canvas backing, driver allocations, query-set
storage and physical residency. Environment/scene resources and texture inventory
are in the raw receipt. No history/classifier arrays exist in this fixture.
Cleanup checks returned adaptive owner bytes to zero; no unexpected device loss
or validation error occurred in the final completed run.

## Retained attempts and integrity

[Summary and raw timing rounds](paired-adaptive-2026-09-20.json).
[Unmodified linear RGBA arrays, receipts and PNGs](paired-adaptive-2026-09-20.tar.gz),
SHA-256 `d4a44cd3ca2bfe55df06e0b460945e3941000272710f710a4edba9921128eb1f`.
The archive contains eight files, from two captures:

- `paired-adaptive-2026-09-20T13-16-41-741Z`: renderer `cb5247d3f35e4cda7fd0a75f6ce0d13ecec4209d`.
  Completed images/counts; empty timestamp marker passes returned invalid ranges.
  GPU timings rejected. Retained job means: fixed/reduced 16.20/24.35 ms environment,
  21.34/29.32 ms diffuse. Do not pool with the final instrumentation run.
- `paired-adaptive-2026-09-20T13-29-31-477Z`: renderer `c6d490a…`, final run above.
  Complete first/final compute-pass pairs produced positive monotonic spans.
  Four raw query values per frame remain available. Every GPU duration was
  independently recalculated from them and was within corresponding job time.

Both captures have identical linear image hashes in every mode and reference.
Metrics and paired intervals were independently recalculated from retained data.
Per-scene receipts were written before the outer run completed and still say
`running`; they were not relabelled. The browser's final receipt separately showed
`measured`, two complete scenes, 30 timed frames each and no failures. `measured`
means the experiment completed, not that its quality/performance gates passed.

Additional attempts stopped before scene artifact upload and are retained here:

| Start / capture ID suffix (UTC, 20 September) | Renderer commit | Failure and disposition |
| --- | --- | --- |
| 13:19:13.540 / 13-19-05-268Z | `173d4fca662e547b47b49f51fa1ffe6792ca37c5` | `encoder.clearBuffer is not a function`; zero measured frames, one warmup. Fixture facade corrected and regression-tested. References still had invalid timestamps. |
| 13:21:17.597 / 13-21-04-709Z | `1983009991c5228bf4120591ffa351bbc96e1626` | `Incomplete fixed pixel 0`; first reference rejected, no timings admitted. |
| 13:23:24.121 / 13-23-10-452Z | `6dfbcd94d2005db31f141d16d4a9602bceb4aa42` | Fixed pixel 0 completed 127/128; raw timestamps `1185833570729984,0`; invalid range and incomplete reference rejected. |

The final internal opt-in four-query telemetry mode leaves default public-renderer
two-query descriptors/allocation unchanged. This resolved the diagnostic on this
runtime; a browser/driver root cause for the end-only compute behavior is **not**
established. No transport, scene, sample budget or quality tolerance was changed
to obtain the final results. See [replay setup](../paired-adaptive-replay.md).

## What remains before claiming benefits

1. Protect noise-sensitive/material/edge regions in the real importance policy;
   these synthetic bands are not ready for rollout.
2. Reduce per-tier/pass/configuration overhead and measure it separately; keep the
   existing transport and actual-camera-sample accounting intact.
3. Qualify stable fixed32 and references in Eames and the approved scene/matrix,
   with independent sampling seeds, denoise-off HDR and frozen tolerances.
4. Measure each actual flagged mechanism, then combinations at matched quality,
   larger workloads and target devices; add motion, history and failure sequences.
5. Complete integration, provenance-bound baseline PR94, post-push CI, applicable
   release gates and the paper ledger before quantitative publication claims.

Local renderer: 267 tests, 95.76% line coverage; lighting: 126 tests, 80.24% line
coverage. Both passed lint, type checks, builds, package and package zero-Three
gates. Physical evidence above is a bounded diagnostic, not full qualification.
Tasks stay In Progress; no site flags, release or white-paper edition was changed.
Three.js remains prohibited; rollback remains the fixed GPU-native renderer.
