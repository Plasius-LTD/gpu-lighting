# Glass and water room reference

Parent Epic: Plasius-LTD/plasius-ltd-site#2113. Parent Feature: #2114.
Story: plasius-ltd-site#2291. Tasks: gpu-lighting#105 and gpu-renderer#233.
Inherits `renderer.sampling.adaptivePerPixel.enabled` and public-route
`gpu-demo.scene-fidelity.enabled`, both default off. This local validation fixture
has an independent off/empty/filled selector; it does not enable production access.

## Problem and scope

The room has opaque material references but no controlled nested transmissive
object. Reuse the existing gpu-lighting scene composition and gpu-renderer mesh-BVH
transport. Add an original parametric thick-walled drinking glass with a closed
water volume, a neutral support and a configurable camera close-up. No new
dependency, imported renderer, external asset licence or private model rewrite.
Three.js is prohibited in every dependency/artifact and cannot be a fallback.

The original renderer tracked absorption media but assumed air on one side of
refraction. The user approved separate transport corrections on 2026-10-07 in
gpu-renderer#234. Scene optical metadata supports that work; it does not establish
water realism or authorise hiding contact errors behind an artificial air gap.

## Geometry and controls

Lighting owns an original deterministic surface-of-revolution mesh generator:
closed thick cup, open cavity, positive wall/base thickness, closed water surface.
Controls include fill fraction, dimensions, segment count, placement, glass/water
IOR and close-up distance. Use explicit bounded defaults, no resolution-dependent
geometry. A small documented glass/water overlap avoids coincident triangles;
correct overlapping-medium handling is a qualification prerequisite. No liquid
dynamics, moving meniscus, bubbles, spectral dispersion or caustic convergence
claim. The neutral support is explicitly added fixture geometry.

Renderer fixture owns accessible off/empty/filled controls and optional close-up,
using the existing renderer, sample-count validation, physical probes, cancellation
and provenance-bound raw/clean captures. Off returns the original composition
unchanged. Capture receipts record parameters, added triangles, medium identities
and the known nested-IOR limitation. Do not override existing room/seat materials,
lighting, sampling, denoise or camera unless a corresponding control is selected.

## Acceptance and tests defined before implementation

- Pure unit tests: finite bounded configuration; empty/half/full states; manifold
  surfaces, outward winding, no degenerate triangles; volume, dimensions, separate
  media, no air-gap disguise; disabled identity and no source mutation.
- Integration: composition counts/bounds, collision-safe placement admission,
  preserved source material objects and original room-off camera; close-up finite
  and outside the object; invalid input rejected before GPU work.
- Physical WebGPU: actual 1080p room and close-up with raw HDR/counts retained;
  no validation error, overflow, timeout or device-loss success claim. A diagnostic
  appearance is not optical correctness. Retain memory/timing and exact sources.
- GPU cost: bounded added mesh triangles/BVH, no new rendering pass or allocation
  policy. Existing medium table/queues reused; extra intersections may cost time.
- Tests/coverage >=80% and changed source LCOV, lint, type/build/package/Zero-Three,
  documentation/Unreleased CHANGELOG, exact-head post-push CI; release/CD only via
  approved main workflow when separately authorized.
- Rollback: fixture off restores original scene; GPU-native only. No publication
  or performance/photographic claim. Further transport work needs its own tracked
  acceptance, flag and physical Snell/Fresnel/total-internal-reflection tests.

## Browser QA inventory

- Original/off and reset: original composition and camera are retained; selecting
  empty/filled and returning to off restores the controls without changing assets.
- Empty and filled: render each at 1080p with the same close-up/capture settings;
  inspect the actual raw/clean images for walls, rim and water level. The images
  demonstrate diagnostic scene integration, not qualified nested optics.
- Fill, dimensions, position and both IOR controls: edit through labelled fields,
  verify the receipt records the values, then reset. Check close-up distance and
  elevation separately from the preserved room camera.
- Off-happy-path: request a glass close-up with glass off, and place the support
  outside the room; both must report validation errors before rendering.
- Inspect the initial controls, render progress, final overview and close-up at
  the available desktop viewport for clipping/legibility. Exercise changes and
  reset during a short exploratory pass. Full mobile/accessibility certification
  and optical correctness remain outside this local diagnostic acceptance.
- Retain source-pinned receipts, HDR/count evidence and screenshots. Report any
  skipped visual check or capture failure explicitly; do not infer success from
  unit tests or a receipt alone.

## Historical pre-correction test result, 2026-10-07

Geometry/control implementation passes local tests and CI, but the actual room
and close-up glass captures fail closed. Empty/filled one-SPP 1080p close-ups
confirmed 290/267 continuation queue overflow events in the first failing tile.
The multi-sample filled room also failed with rough splitting both on and off.
Do not claim image, HDR or optical qualification. Renderer Task
[gpu-renderer#234](https://github.com/Plasius-LTD/gpu-renderer/issues/234) records the
bounded branching and nested refraction follow-up; subsequent implementation
and physical qualification are recorded there.
The original room remains available with the glass selector off.
## Optical metadata follow-up (#105 / gpu-renderer#234)

The user approved transport corrections on 2026-10-07. The scene now supplies
explicit medium IOR and configurable integer `glassPriority` / `waterPriority`
(defaults 2 / 1). Higher priority wins; validation requires glass to outrank water.
This lets overlapping water enter occupancy without creating a spurious
glass-to-water-to-glass bounce. The separately controlled renderer flags are
`renderer.transport.boundedDielectricBranching.enabled` and
`renderer.transport.nestedMediaRefraction.enabled`, both default off. Geometry,
material colour and the off composition are unchanged. The room capture settings
accept a fourth `maxDepth` argument (integer 1..8, default 6), validated against
the completed frame. Historical results above are not evidence for corrected
transport. Renderer `c605bd3b831ba504692def40e02f0e0025e6c87b` with lighting
`1d76fa54d70741172f36fc328eebfd8d1bb65c69` completes the empty 1080p, uniform
32-SPP, six-bounce close-up (66,355,200 completed samples). This is functional
integrity evidence, not image convergence or real-time qualification.
