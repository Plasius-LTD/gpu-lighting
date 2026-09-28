# Room plus Eames local adaptive reference

## Material comparison layout revision (site#2256 / lighting#103)

The user requests the standing reflective reference at the old Eames location
and the complete Eames group at the old standing-reference location. Defaults
become Eames X/Z 2.3/-2.5, standing reference 1.8/-1.1; keep their respective
yaw angles and floor contact. Keep the entry camera and its old target fixed
so the standing reference occupies the high-SPP centre instead of moving the
camera with the Eames. Reset and initial UI values must agree with the composer.

The first local reference is displayed at 2.1 m source-local width with uniform
scaling on all three axes, preserving its authored proportions (the user
explicitly rejected width-only stretching before implementation). This is a
user-requested scene override, not an authored asset dimension. Scale geometry
about its source centre, retain normal directions under uniform scaling before
rigid rotation; retain UVs, materials,
indices, all primitives, original asset bytes and provenance. Record the scale
factor, source/display dimensions and override reason. No geometry decimation,
new material policy, transport, lighting or exposure change in this revision.

Tests must cover the exact swapped defaults, stable camera target, measured
width and proportional height/depth, unchanged normal directions, immutable inputs,
two-model preservation, invalid/degenerate extents and room bounds. UI QA uses
Render/Reset, Eames-only/all selection, an invalid placement and cancellation;
native 1080p/4K raw/clean captures must show all models without clipping or
overlap. Inspect the new centre subject separately from the older off-centre
image. No comparison with another renderer is image-quality qualification
without matching camera, lighting, sample counts and display transform.

The screenshot comparison also prompts a read-only material-path investigation:
check texture channel mapping, per-hit vs coarse material categories, filtering
eligibility and low-SPP placement. Record confirmed defects separately from
lighting/sampling hypotheses. Do not silently override the suit's authored
metalness/roughness or change the transport merely to match the screenshot.
Existing default-off parent flags, local-only assets, full validation and
GPU-native-only rollback remain unchanged. Three.js remains prohibited.

Tasks renderer#169 / lighting#87; Stories site#2119/#2125; Feature site#2114.
User supplied a room GLB and explicitly requested the original Eames inside it,
with an interior viewpoint and model-placement interaction.

## Scope and reuse
gpu-lighting owns a pure reference-scene composer and scene admission. Reuse
gpu-shared loadGltfModel and createProductStudioMeshes for existing material and
attribute conversion; discard the four explicitly verified Product Studio
environment meshes, never the Eames model. Room coordinates remain unscaled.
Place the complete Eames chair/ottoman as one rigid group, preserving materials,
textures, indices and normals. Assign distinct mesh/material identities.
Renderer owns a separate local reference page using the existing paired runner,
radial budgets, unchanged transport and completed-count evidence. Keep the old
Eames-only page intact. No new package dependency or Three.js runtime.

## Interaction and lighting
Native 1080p default and explicit 4K; six-bounce ceiling, 32 maximum,
5.95 average SPP, denoise off; fixed-pattern working sampler, stable comparison.
Camera presets are inside the main room with a fixed comparison target at the
original Eames position (now the standing-reference position).
Placement exposes X/Z and yaw; chair floor alignment is deterministic.
Bounds admission prevents escape from the room AABB, but there is no wall
collision/physics guarantee. No live drag, moving-mesh transport, animation,
automatic budget changes, new sampler, production rollout or performance claim.
The room has no authored camera/emitter: use a labelled external daylight
environment only, no hidden ceiling/floor/panel or added emissive mesh.
Controls apply on Render; lock during work. Cancel waits for bounded GPU work.
Changes invalidate old image/receipt/download. Reset restores the default view.

## Privacy, provenance and rollback
The user explicitly approved committing the room model and demo to the public
repositories. Preserve the original GLB and checksum under gpu-lighting demo assets;
do not commit the user's private local filesystem path. Diagnostic captures may
be retained as public evidence with source provenance. The loopback server exposes
only the approved model and source
routes; no directory browsing or general filesystem exposure. Validate byte
count and SHA256 before loading, and record room hash plus original Eames asset
hashes and source commits. GLB exporter metadata is inert provenance, not a
runtime/package dependency; do not rewrite the user's source asset.
Existing parent renderer.sampling.adaptivePerPixel.enabled and sampler flags
remain production-default off; the page is an explicit local validation lane.
Rollback returns to the existing local Eames page / fixed GPU-native rendering.
Three.js is prohibited and cannot be a fallback.

## Acceptance / requirements-first tests
Composer: preserve room scale and all model attributes; strip only known studio
meshes; admit original Eames geometry/textures; correct rigid rotation/normals,
floor contact, unique IDs, finite/bounded placements, presets and invalid input.
Fixture: exact native resolution/depth/sampler/count/histogram admission, correct
scene identity, failed/aborted renders cannot become successful receipts,
no stale preview, source hash required. Snapshot controls at render start.
Physical WebGPU: actual scene counts, valid native PNG, completed==requested,
no validation errors/overflow/device loss, cleanup, two placements/views and 4K.
Retain failures and diagnostic timing separately; no matched-quality claims.
Tests/coverage/lint/types/build/package/Zero-Three and post-push CI; update
README and Unreleased CHANGELOG. No release/main/CD activation.

## Browser QA inventory
Initial view: room/Eames purpose, experimental warning, daylight label and
primary controls visible. Render interior at 1080p then 4K and visually verify
both assets, framing and absence of old studio geometry. Change camera, X/Z,
yaw and sampler, then reset, checking stale capture clearing and resulting
metadata/image. Check locked controls, cancel/restart, invalid coordinates,
download filename/dimensions and evidence retention. Inspect desktop/narrow
layout and numeric overflow, then restore viewport. Two negative scenarios:
cancelled capture and out-of-bounds placement. Keep final room image visible.
