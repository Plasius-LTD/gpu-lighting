# Bounded rough-bounce splitting: room/Eames experiment

Status: experimental, not converged-quality, matched-quality, real-time or
production qualification. This does not support a white-paper performance claim.

## Question and controls

Can extra diffuse continuations amortize the shared camera/first-hit work and
improve low-SPP averaging at bounded cost? Compare no splitting, 2/1/1/... and
2/2/1/... at the first absolute bounce indices, then stop splitting. The original
complete BSDF remains; this does not remove dielectric specular reflectance.
Each child has half throughput and all descendants count as one camera sample.

All three variants use the same stable-pattern sampler. The faster shared-point
sampler is retained in the room page, but is not a valid decorrelated splitting
control: it has known cross-event correlation. Do not attribute that sampler
change's effects to splitting. No material, lighting, exposure or denoising edits.

Original room plus Eames: 269,140 triangles, 82 meshes, original material maps,
mesh BVH, entry camera, chair placement X=1.8/Z=-1.1/yaw=-25. Six-bounce ceiling,
32 maximum SPP and the prescribed circular 32/16/8/4/2/1 budget (5.95 average).
Native 1920x1080 and 3840x2160; no upscaling. Denoise disabled.

## Reproduction and provenance

- Renderer [06bc5446](https://github.com/Plasius-LTD/gpu-renderer/tree/06bc5446ccb296ff1edd3cdb1fc39feeeceb3a57).
- Lighting [2ece2262](https://github.com/Plasius-LTD/gpu-lighting/tree/2ece2262e18d212d98cd656390db333d72da37ba).
- Shared loader [729f89c7](https://github.com/Plasius-LTD/gpu-shared/tree/729f89c7f77fcadb9ee7eeca53fb6daf02865b8e).
- Eames site manifest commit `21d43a9b63722f1ce69175a5a42b53304ee79102`.
- Room GLB SHA-256 `125331dadb83664e978a8c12cc974bae81bb7b75457e290c6063d921bbe11bc5`.

Run the README's commit-snapshot room server from clean matching checkouts,
open the room page, choose native resolution and use **Measure splitting: off
vs first vs first two**. Keep the browser tab visible. One warmup per variant,
then three rotated timing-only rounds, then separate diagnostic frames. Setup,
readback/image encoding and capture retention are excluded from timing-only jobs.
GPU timestamps below are from diagnostic frames, not the timing-only medians.

The captures predate a metadata-only correction to continuation-workgroup
upper-bound estimates and an overflow-only termination-counter correction.
Do not consume the old `estimatedIndirect*UpperBound` fields for split runs.
The direct/indirect dispatch counts and GPU-observed ray totals used here are
unaffected; tests compare the encoded command stream before/after the metadata
change. Successful-frame transport and shader record layouts are unchanged.

Three renderer instances coexist, submitting sequentially. Report per-instance
application-visible allocations, not exact physical VRAM residency. The experiment
does not establish single-device production steady state or sustained frame rate.

## Correctness checks

Black and directly visible emission retain exact expected radiance in all modes.
The constant-environment rough-surface test retains per-channel mean energy
within its pre-frozen 2% relative screen. This checks parity with existing
transport, not absolute correctness of that transport. Every native pixel must
complete its requested camera-sample count, all HDR values must be finite and
nonnegative, and overflow/validation/device failures reject the capture.

Independent file verification reassembles every lossless float32 HDR chunk,
checks chunk and whole-image hashes, native PNG dimensions, per-tier counts,
primary/secondary/segment consistency and allocation deltas. Raw receipts/HDR
remain in the local capture directories named by the retained verification JSON.

An initial two-triangle emissive quad failed even with splitting off: component
508 was 3.625 instead of 4. This is a suspected shared-edge traversal miss, not
a proved splitting defect. Both rejected captures are retained. A single
oversized triangle isolates bounce energy without relaxing the exact tolerance.
The original room mesh is unchanged. Investigation remains tracked in
[renderer Task 169](https://github.com/Plasius-LTD/gpu-renderer/issues/169#issuecomment-5867901014).

## Measured results

Physical Apple WebGPU adapter (`vendor: apple`), macOS 26.6.2, in-app browser.
The user identifies the machine as M2 Max; the retained adapter fields do not
independently identify the commercial GPU model. Each timing is **seconds per
complete render job**, not milliseconds or an interactive 60 Hz result.

| Resolution | Schedule | Median job (s) | Range (s), three runs | Cost vs off | Diagnostic GPU (s) | Path segments |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| 1080p | Off | 10.138 | 10.036–10.142 | — | 9.379 | 37,333,735 |
| 1080p | 2/1/1 | 11.671 | 11.431–11.686 | +15.12% | 11.043 | 57,330,028 |
| 1080p | 2/2/1 | 13.341 | 13.329–13.570 | +31.59% | 12.724 | 79,102,283 |
| 4K | Off | 36.488 | 36.373–36.553 | — | 33.540 | 149,355,508 |
| 4K | 2/1/1 | 42.481 | 42.098–42.690 | +16.43% | 39.812 | 229,287,859 |
| 4K | 2/2/1 | 49.043 | 48.867–49.534 | +34.41% | 46.693 | 316,403,266 |

All modes complete exactly **12,337,920 / 49,351,680 camera samples** at
1080p/4K. Dispatch totals stay **21,460 / 74,568** respectively. At 1080p,
secondary rays rise from 24,995,815 to 44,992,108 / 66,764,363; at 4K from
100,003,828 to 179,936,179 / 267,051,586. Extra rays do not multiply pass count.

Mean linear RGB versus the no-split control changes +0.114% / +0.082% at
1080p and -0.024% / -0.016% at 4K for depth 1 / 2. The constant-environment
probe changes less than 0.04% per channel; black and [4,2,1] emission are exact.
All six native diagnostics have exact requested/completed tier histograms,
zero reported validation errors and successful cleanup. Full HDR hashes and
PNG dimensions were independently checked after retention.

### Application-visible allocations

Splitting adds exactly **14 MiB / 42 MiB** to renderer buffers for depth 1 / 2
at both resolutions. The admitted extra-allocation cap is 128 MiB. Textures,
adaptive state, telemetry, staging and cached budgets do not grow with splitting.
These are requested resource bytes, not physical residency or total process RAM.

| Category | 1080p bytes | 4K bytes |
| --- | ---: | ---: |
| Renderer buffers, off / depth 1 / depth 2 | 189,378,844 / 204,058,908 / 233,419,036 | 195,522,844 / 210,202,908 / 239,563,036 |
| Textures, all modes | 104,846,248 | 229,262,248 |
| Adaptive buffers, all modes | 9,421,084 | 34,304,284 |
| Telemetry buffers, all modes | 12,352 | 12,352 |
| Fixture staging, all modes | 589,824 | 589,824 |
| Cached host budget arrays, all modes | 18,662,400 | 74,649,600 |

Texture totals include scene atlases and output/environment textures at their
declared format sizes; no mipmaps or multisampling are present in this inventory.
Additional JS scene/BVH/decoded asset/PNG/HDR copies, driver overhead and
browser/compositor memory are not included in these resource totals.

Retained [verification and all timing samples](rough-bounce-splitting-2026-09-28-verification.json).
Native images: [1080p off](rough-split-1080p-off-2026-09-28.png),
[1080p depth 1](rough-split-1080p-depth1-2026-09-28.png),
[1080p depth 2](rough-split-1080p-depth2-2026-09-28.png),
[4K off](rough-split-4k-off-2026-09-28.png),
[4K depth 1](rough-split-4k-depth1-2026-09-28.png),
[4K depth 2](rough-split-4k-depth2-2026-09-28.png).
These are unchanged native renderer PNGs, not generated or retouched images.

## Interpretation and remaining gates

Splitting is a quality/cost experiment. It adds secondary paths, not camera SPP,
and reuses the same dispatch schedule. It cannot fix primary silhouette sampling,
shared-edge intersection defects or all 1-SPP noise. Grain remains visibly present.
RMSE against the low-SPP unsplit control is image difference, not error against
ground truth; global mean parity alone cannot prove unbiasedness or convergence.

Converged HDR references, equal-time/equal-quality comparisons, larger timing
samples/confidence bounds, motion/temporal tests and the full device/scene matrix
remain required before promotion. The flag stays off; disable it and recreate
the renderer for unchanged GPU-native allocations and shader source. Three.js
remains prohibited. No release/CD or white-paper advancement occurs here.
