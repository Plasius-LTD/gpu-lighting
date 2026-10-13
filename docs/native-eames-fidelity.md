# Original Eames fidelity admission

Tasks gpu-lighting#87, gpu-renderer#169, gpu-shared#130; Story site#2125;
Feature site#2114. Parent adaptive flag stays off. Three.js remains prohibited.

The six-triangle native trace is a scheduler diagnostic, not representative
Eames/application cost. Retain it as such; never silently replace its provenance.

## Input and pipeline

The source manifest in `demo/eames-environments/eames-source-manifest.json`
pins seven source files to site commit
`21d43a9b63722f1ce69175a5a42b53304ee79102`. Verify every SHA-256 and byte count.
Load with gpu-shared's canonical glTF loader and Product Studio mesh builder,
not a simplified reference mesh. Require 265,468 model triangles in nine
primitives, five materials, normals/UVs and five original 1024×1024 images.
The room/emissive meshes bring the submitted total to 265,476 triangles.
Required decoded texture objects must survive forwarding to renderer materials.

glTF omission defaults are white base color and metallic/roughness 1, not custom
display defaults. Both shared and reference loaders have regression tests.
This changes source chrome/material transport and invalidates old Eames timings
as a baseline for the corrected scene. No BSDF/PDF/MIS change is introduced.

Use the actual Product Studio camera and procedural studio environment preset
(not an HDRI claim), mesh-BVH/display-quality path, native 1080p and 4K,
32-SPP ceiling and four-bounce ceiling, no denoise or automatic budget reduction.
No geometry, texture-resolution or output-resolution downgrade on failure.

## Comparison and limitations

Renderer fixture `native-eames-trace.html` reuses the native radial driver and
unchanged fixed/shared transport. Original asset hashes, source commits, scene
admission and renderer configuration join the existing raw ray/count/timing/HDR/
memory evidence. Retain loading/scene setup and renderer/BVH setup separately
from completed-frame timing. No repeated texture download is inside frame time.
The immutable replay server serves only selected commit objects, not live files.

Use the same prescribed circular 5.95-SPP budgets and uniform32 identity control,
one warmup and three rotated timing-only pairs, then separate diagnostic captures
at each native resolution. Keep the ordinary transport; optional fusion remains
off following the prior failed 4K identity control. Asset/allocation/device/count
failures are failures, never grounds for silently substituting the toy scene.

Source fidelity admission is necessary, not sufficient: the renderer-only page
does not include the site UI, production scheduling, animation or display latency.
Converged HDR quality, material reference correctness, eight-bounce lanes,
sustained native-resolution 60 Hz and the broader matrix remain open. Nothing
here grants a full-fidelity image, matched-quality performance or publication claim.

## Validation

Test source identity, exact primitive counts, normals/UVs, native texture slots,
neutral textured factors/chrome defaults, submitted textures, lighting and final
GPU scene admission. Missing/reduced/substituted inputs fail closed. Run full
coverage/LCOV, lint/types, builds/package/dependency gates and physical WebGPU.
Keep failed attempts and post-push CI status. No local publish or CD bypass.
