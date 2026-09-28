# Local model reference lane

Parent: site Epic #2113 / Feature #2114 / Story #2249. Reuse the existing
renderer-owned native adaptive runner, shared glTF loader and material mapper,
and lighting-owned radial plan. No new transport or production API.

Accept one explicitly supplied, self-contained static GLB from the local CLI.
Serve an in-memory byte snapshot on loopback only; retain its SHA-256/byte length
separately from immutable code commits. Never commit the private asset, absolute
source path, or derived images to a public repository without approval. Reject
external resources, unsupported required extensions, animations and skins.

Preserve every primitive/material and original scale. No proxy geometry, invented
textures, added floor or emitter. Reuse the existing room/Eames composition and
camera/placement controls for compatible room coordinates. The user corrected
the supplied model to a replacement room. Preserve the original default room
and serve the replacement on a separate port. Validate declared primitives and
triangles and in-bounds camera/chair admission; fail closed for incompatible rooms.

Native 1080p/4K, six bounces and existing 5.95-average radial camera budgets.
Expose existing fixed/stable sampler, bounded rough splitting and guided denoise
controls. These are local test overrides of the inherited default-off flags
renderer.sampling.adaptivePerPixel.enabled,
renderer.sampling.roughBounceSplitting.enabled and
renderer.denoise.guidedSpatial.enabled, not production rollout. Disable the
child controls or return to the unchanged room page to roll back. Three.js is
prohibited, including fallback.

Requirements-first checks: GLB header/chunk length/resource validation; exact
source hashes; all-primitive triangle admission; material identity and source
scale; camera validity; no-added-geometry accounting; existing
sample/histogram/error checks. Retain raw PNG/HDR and same-input denoised PNG/HDR,
GPU postprocess timing, rays, actual counts, memory, commits and cleanup status.
No converged-quality, speedup or real-time claim from this scene trial.

Browser QA inventory: initial controls and native resolution; successful 1080p
and 4K captures; visible room, textured floor and Eames; raw/clean/raw reversal;
camera/reset invalidates prior output; cancellation restores controls; incompatible
fast sampler plus splitting rejects before device work; desktop/narrow layout.
Synthetic unit inputs cover invalid/unsupported models without publishing assets.
Run tests/coverage (changed JS/MJS in LCOV), lint/types/build/package/Zero-Three,
post-push CI. No main/CD or local package publishing.
