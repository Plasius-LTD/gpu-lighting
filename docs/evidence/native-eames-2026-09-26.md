# Original Eames native adaptive evidence — 26 September 2026

Status: source fidelity and diagnostic execution verified; **quality and real-time qualification failed/not established**.
Tasks gpu-renderer#169, gpu-lighting#87, gpu-shared#130; Story site#2125; Feature site#2114.
The adaptive parent flag remains off. No site rollout, release or white-paper promotion.

## What changed

The preceding six-triangle trace is not realistic Eames cost. This capture uses
the original site source asset through the canonical shared glTF loader and
Product Studio mesh builder: 265,468 model triangles, nine primitives, five
materials and all five original 1024×1024 textures. Room/emissive geometry brings
the submitted total to 265,476 triangles and 13 meshes. Actual renderer admission
reports 137,735 BVH nodes, display-quality mesh transport and CPU-upload BVH.

The fidelity audit also found a real loader defect: custom omitted glTF factors
tinted source textures and made source chrome mostly nonmetal. Shared PR131 and
the lighting reference loader now use the format's white/metallic 1/roughness 1
defaults, preserving explicit values. See shared ADR0012 and
[Khronos material schema](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json).
No shader/BSDF/PDF/MIS/termination change was made for this capture. Do not
reuse earlier Eames material timings as the corrected scene's baseline.

The exact shared Product Studio camera and procedural studio-lighting preset
are used; this is not an HDRI environment claim. Source images, normal maps,
UVs, texture transforms and material records follow the existing loader/adapter.
Hash and dimension admission verifies the inputs, not full glTF conformance or
physically converged image quality. No texture/geometry proxy, automatic frame
budget, motion reduction, denoise, resolution downgrade or temporal reuse.

## Immutable provenance

Capture ID: `native-eames-2026-09-26T20-21-11-137Z`.

- Renderer `95daedd5bc55882273416a13050e26b63b3e42e0`.
- Lighting `39e05f94af8ca52db1b1eb7f23615f02288cbb69`.
- Shared loader/builder `729f89c7f77fcadb9ee7eeca53fb6daf02865b8e`.
- Site asset source `21d43a9b63722f1ce69175a5a42b53304ee79102`.

All served code/assets came from those Git objects. Seventeen module/page/manifest
hashes and all seven source-file hashes/byte counts were independently checked.
The receipt includes the source manifest, texture slots, camera, actual renderer
configuration, allocation inventory and physical Apple/Metal-3 nonfallback adapter.
The host is the user's M2 Max MacBook Pro. No browser user-agent/version receipt
is available, so this is another provenance limitation for publication qualification.

## Native completed-frame results

One warmup followed by three rotated timing-only pairs at each resolution;
same source, seed 7, maximum/sequence period 32 and four-bounce ceiling.
All 135/510 tiles and GPU presentation commands are included. All measured frames
report visible before and after. These are short renderer-job timings, not
sustained display cadence or full GPU-tab/application timings.

| Measurement | 1920×1080 | 3840×2160 |
| --- | ---: | ---: |
| Fixed32 mean job | 12,368.57 ms | 43,994.43 ms |
| Prescribed radial mean job | 3,542.67 ms | 11,532.23 ms |
| Observed lower-SPP time reduction | 71.36% | 73.79% |
| Fixed primary rays | 66,355,200 | 265,420,800 |
| Radial primary rays | 12,337,920 | 49,351,680 |
| Fixed total path segments | 140,451,904 | 561,806,006 |
| Radial total path segments | 27,787,871 | 111,144,433 |

Every diagnostic pixel's completed count was validated. Radial mean is exactly
5.95 SPP, with the requested centred circular area shares. Primary rays decrease
81.40625%; path segments decrease approximately 80.22%. **Fewer rays and shorter
jobs do not establish matched-quality speedup.** All timing frames fail the
16.6667 ms target; even the adaptive 1080p mean is over 200 times that budget.

Timing samples (ms): fixed1080 [12353.30, 12349.50, 12402.90];
radial1080 [3517.40, 3534.00, 3576.60]; fixed4K [44101.70, 43830.90, 44050.70];
radial4K [11589.20, 11238.90, 11768.60]. These three-pair screens do not establish
the full baseline variance/qualification confidence gate.

## Separate instrumented attribution

| Diagnostic measurement | 1080p fixed / radial | 4K fixed / radial |
| --- | ---: | ---: |
| Sum of GPU tile spans | 10,720.71 / 3,089.50 ms | 37,855.43 / 10,041.62 ms |
| CPU command encoding | 113.90 / 22.90 ms | 434.30 / 92.90 ms |
| CPU config packing, exclusive | 15.20 / 4.90 ms | 50.50 / 17.60 ms |

GPU spans exclude uploads and final presentation and come from separate frames;
do not subtract them from timing-only means to invent exact overhead. CPU values
are host elapsed intervals, not utilisation. GPU-completion/readback waits yield
JavaScript and are not CPU busy time. Serial 136/511 submissions remain, but the
multi-second GPU spans show this is not predominantly a CPU-packing problem.
No claim that batching alone can close the real-time gap is supported.

Loading, hash verification and shared scene preparation: 1,040.70 ms.
Renderer/pipeline/BVH setup: 5,043.70 / 3,819.70 ms. These setup figures are
outside steady frame timings and include initialization, not isolated BVH time.

## Quality and stability

Ordinary uniform adaptive32 is **bit-identical** to fixed32 at both native sizes;
ray totals also agree. Every retained native HDR float is finite/nonnegative and
the diagnostic counts match their budgets. No captured GPU validation error,
overflow, timeout or device loss occurred; adaptive cleanup reached zero bytes.
This is one successful short capture, not sustained stability qualification.
The optional fused-hit path stays off due to the earlier failed 4K identity control.

The radial image visibly contains noise and circular brightness boundaries.
Against same-run fixed32 (not a converged reference):

| Linear-HDR difference | 1080p | 4K |
| --- | ---: | ---: |
| Normalized RGB RMSE | 0.122411 | 0.123867 |
| Relative scene energy difference | -2.7453% | -2.7319% |
| 16-SPP ring energy difference | -9.7218% | -9.7514% |
| 1-SPP ring energy difference | -6.4051% | -6.4132% |

The central32 region is identical. Whole-scene energy averages conceal large
regional errors. These are observed differences, not proof of an estimator bias
or a known root cause; sampling-prefix correlation and reduced-budget behaviour
need investigation against independent seeds and converged references. Do not
relax frozen tolerances or promote performance claims while these defects remain.

## Application-visible allocation inventory

| Category | 1080p bytes | 4K bytes |
| --- | ---: | ---: |
| Renderer buffers | 184,339,868 | 190,483,868 |
| Renderer texture descriptor texels × format size | 100,627,336 | 225,043,336 |
| Adaptive buffers | 9,421,084 | 34,304,284 |
| Telemetry buffers | 8,256 | 8,256 |
| Fixture staging | 589,824 | 589,824 |
| Cached host budget arrays | 18,662,400 | 74,649,600 |

Texture arithmetic excludes driver padding/residency and browser swap-chain
ownership; host geometry, decoded assets, temporary packing and browser heap
are not a complete heap accounting here. Both comparison modes share the harness
allocation, including adaptive resources. This does not qualify disabled-state
allocation equivalence or claim that fewer rays save memory.

## Retained artifacts and independent checks

- [1080p raw receipts, display images, budget maps, HDR chunks and combined summary](native-eames-1080p-2026-09-26.tar.gz).
  SHA-256 `1c9c0166ada9c3c3f2b4bcda659c38f07fc680c583534e5643b6b8ad68fffe8a`.
- [4K fixed and identical-uniform receipts/images/HDR](native-eames-4k-fixed-2026-09-26.tar.gz).
  SHA-256 `1c86591e5dae245e9dacbb4d7335c3b7828f818acc9790fca72e7211001f4cb2`.
- [4K radial receipts/images/HDR, budget map and lane trace](native-eames-4k-radial-2026-09-26.tar.gz).
  SHA-256 `cd55e1203f5f738cd898ef0d41292b4f2fd9968d09b505941a83b75b80a494cc`.
- [Independent verification](native-eames-2026-09-26-verification.json).

Independent replay reconstructed every HDR chunk and image SHA-256, checked
contiguous offsets, native PNG dimensions, uniform bit identity, regenerated
budget hashes/histograms, re-read ray/tile sums and raw timestamp spans,
recomputed timing means and full-frame HDR differences. Original receipts remain
unmodified. Use fixed/radial PNGs for images, not chunk markers or post-teardown
trace/summary PNGs.

Reconstruction follows the [native radial byte-plane/gzip protocol](native-radial-2026-09-26.md).
To recapture, serve the pinned renderer at /src and /tests/fixtures, lighting at
/lighting (including src), shared at /shared/src, and the manifest-listed original
Git objects at /eames. Serve immutable /__provenance with all four commits and a
fresh capture ID, plus the existing bounded loopback capture bridge. Open
/tests/fixtures/native-eames-trace.html with physical WebGPU. Never replace
original assets or reuse capture IDs for retries.

## Delivery and remaining gates

Local validation: renderer302 tests /96.01% lines, lighting144 /80.52%,
shared107 /87.72%. Changed loader/helper executable files are in LCOV;
the new Eames admission helper has 100% lines/branches. Regression cases failed
before their fixes. Lint, types/syntax, build, package/privacy checks, all nine
Zero-Three evidence surfaces and runtime dependency audits pass (zero findings).
README, Unreleased CHANGELOG, design, shared ADR/TDR and evidence are updated.

Post-push CI and applicable approved main/CD release gates remain required.
PRs216/99/131 stay draft; Tasks/Feature stay open. No local publishing or production
flag change. Three.js remains prohibited and cannot be a fallback.

Remaining: correct reduced-prefix quality, profile/optimize the representative
GPU workload, integrate the public full-native adaptive path into the site's GPU
tab, then run converged HDR and the complete depth/SPP/motion/environment matrix,
sustained native60Hz, memory and device-stability qualification. Four-bounce
renderer-only source fidelity must not be described as complete full-pipeline,
eight-bounce or publication qualification.

