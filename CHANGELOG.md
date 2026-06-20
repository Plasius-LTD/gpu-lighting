# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - Extended the wavefront lighting contract with compact medium-state carry,
    visibility-probe ray helpers, MIS/exclusive-emissive probe controls, and
    deterministic CPU reference fixtures for continuation validation.

- **Changed**
  - Wavefront ray-record documentation now mirrors the current renderer payload
    shape, including medium-stack and spectral-state fields used for transport
    validation.
  - The Eames validation page now defaults display-quality captures to
    `accelerationBuildMode=cpu-upload` while still allowing explicit GPU BVH
    validation through the query parameter.

- **Fixed**
  - Wavefront continuation helpers now report total internal reflection
    explicitly and keep refraction/transparency medium transitions stable in the
    published reference contract.
  - The Eames validation mesh transform now floor-aligns scaled product meshes
    by their actual lower bound instead of centering them through the analytic
    floor plane, preventing chair geometry from rendering mostly below ground.
  - Eames validation captures at 4 SPP and 8 SPP no longer depend on the
    corrupted display-quality CPU-upload material path or the broken high-SPP
    tile scheduling order, so browser-driven runtime screenshots now render the
    chair coherently instead of producing striped/blocked artifact regions.

- **Security**
  - (placeholder)

## [0.2.6] - 2026-06-16

- **Added**
  - Added concrete volumetric WGSL kernels for `volumetricShadow` and
    `froxelIntegrate`, covering froxel shadow history plus scattering/extinction
    integration for the published realtime and reference profiles.
  - Added concrete HDRI/IBL WGSL kernels for `irradianceConvolution`,
    `specularPrefilter`, and `brdfLut`.
  - Added a renderer-aligned `wavefront` lighting technique with concrete
    WGSL jobs for terminal radiance accumulation and continuation scattering.
  - Added `createWavefrontLightingPlan()`,
    `evaluateWavefrontTerminalRadiance()`, and
    `evaluateWavefrontContinuationEvent()` so downstream packages and tests can
    validate emissive-hit, environment-hit, miss-darkening, reflection,
    refraction, and transparency behavior without reimplementing the contract.

- **Changed**
  - README now documents the delivered volumetrics and HDRI kernel scope with
    technique-level descriptions instead of leaving those exported jobs implied.
  - Eames capture helpers now resolve workspace roots correctly from both
    ordinary repo checkouts and `git worktree` paths.

- **Fixed**
  - Package tests now fail if any exported `hybrid`, `volumetrics`, or `hdri`
    job regresses to placeholder text or an empty/no-op `process_job` body.
  - Eames asset-path and capture-bridge tests are now worktree-safe instead of
    assuming the package always lives under a literal `/gpu-lighting/` path.

## [0.2.2] - 2026-06-11

- **Added**
  - Added `environmentMap`/`hdri` passthrough in wavefront lighting options so
    renderers can use HDRI/equirectangular radiance textures as environment
    light sources instead of relying primarily on static ambient colours.
  - Added `sunlitBaseline` to environment lighting presets and wavefront
    lighting options so renderers can apply a time-of-day daylight floor at
    terminal path collisions without raising ambient residual colour.
  - Added an Eames screenshot capture runbook and browser-runtime helpers so
    validation scripts can attach to an existing WebGPU-capable Chrome over CDP
    instead of only launching a fresh Playwright Chromium profile.
  - Added generic glTF material forwarding in the Eames validation loader so
    authored specular, sheen, clearcoat, transmission, emissive, and IOR values
    can flow into the shared wavefront renderer without model-name overrides.
  - Added Eames validation HUD/result diagnostics for GPU worker-job throughput
    so validation runs can report compute-dispatch jobs per frame, per second,
    and per command submission.
  - Added adaptive Eames validation frame budgeting so motion-oriented runs can
    request a `frameTimeBudgetMs` and inspect delivered `rendered/target spp`
    in the HUD and result payload.
  - Added `@plasius/gpu-performance`-governed adaptive SPP control to the Eames
    validation harness so frame-budgeted runs degrade and recover through a
    shared quality-ladder contract instead of a demo-local policy alone.

- **Changed**
  - Reduced ambient residual strength for the grass-field, forest, warehouse,
    and cavern environment preset families to avoid low-sample whitewash.
  - Eames validation capture scripts now pin deterministic render settings by
    default and write canvas-only PNG artifacts plus comparable black-pixel and
    luminance metrics under `output/playwright/eames-environments/`.
  - Eames validation page and capture entry points now accept up to `256 spp`,
    and the validation boot timeout now scales with requested render workload
    instead of failing at a fixed 60-second watchdog.
  - `gpu-lighting` local typecheck coverage now includes the Eames validation
    page, loader, and capture helpers instead of checking only the legacy demo
    entry points.
  - Eames validation mesh loading now preserves authored UVs and decoded
    base-colour, metallic-roughness, normal, and occlusion maps so the shared
    wavefront renderer can evaluate materially richer leather, wood, and chrome
    surfaces.
  - Eames validation meshes now forward decoded emissive maps as well so the
    shared wavefront renderer can keep all material texture evaluation in the
    GPU render path.
  - Eames validation mesh building now preserves authored material values
    generically instead of deriving chrome, leather, and wood behaviour from
    material names.
  - Eames validation page can now freeze its own canvas and POST the PNG back
    to a local bridge endpoint, which provides a browser-driven screenshot
    fallback when Playwright cannot own the Chromium process directly.
  - Eames validation capture and reverse-pass debug entry points now share one
    server-selection helper so port reuse, static serving, and bridge-ready
    startup rules stay aligned across local runs and CI.

- **Fixed**
  - Eames Playwright validation pages and capture scripts now surface import,
    WebGPU bootstrap, and renderer startup diagnostics instead of hanging on the
    initial HUD when a browser cannot complete setup.
  - Eames validation renders now collect optional output-probe figures after the
    frame render completes instead of coupling probe readback to the heavy
    high-SPP render submission itself.
  - Eames capture helpers now resolve browser profile and temporary output paths
    through the host OS temp directory instead of assuming macOS-only
    `/private/tmp`, which fixes Linux CI validation.
  - Eames validation query parsing now preserves documented fallback defaults
    when numeric URL params are omitted, which keeps standard captures out of
    accidental reverse-pass debug mode.
  - Eames validation motion renders now preserve the built-in adaptive
    `frameTimeBudgetMs` default when the query parameter is omitted, so the
    shared `@plasius/gpu-performance` quality ladder still engages on the
    standard animated validation route.
  - Animated source-marker captures now reuse the injected product-studio scene
    helper during per-frame rebuilds instead of throwing when motion is enabled.
  - Eames capture waits now scale with requested resolution, frame count, depth,
    and SPP so higher-workload validation runs are not aborted at a stale fixed
    timeout.
  - Eames glTF validation materials now honor `KHR_texture_transform` offsets,
    scales, and rotation by baking transformed texture maps during decode so
    chair screenshots reflect the authored leather and wood layouts.
  - The capture bridge now rejects non-loopback browser origins and confines
    capture writes to `output/playwright/eames-environments/`, which closes the
    browser-driven workspace overwrite path on the local upload endpoint.
  - The Eames glTF loader now honors interleaved `bufferView.byteStride` values,
    which keeps positions, normals, and UVs correct for legal strided assets.
  - The capture bridge now serves static assets without a pre-stat/read race,
    and browser-driven capture uploads are restricted to loopback bridge URLs.
  - The standalone repo now ships the Eames demo asset set referenced by the
    validation page so fresh checkouts can render the chair without external
    workspace-only files.

- **Security**
  - (placeholder)

## [0.2.0] - 2026-06-06

- **Added**
  - Added environment-light portal contracts to the reusable environment
    lighting config so renderers can guide and gate sky/HDRI contribution
    through room openings such as windows.
  - Added grass-field, forest, warehouse, and cavern environment lighting
    preset families with dawn, midday, dusk, and night variants plus normalized
    light-source metadata for environment-miss inference.
  - Added scene/time-of-day preset aliases so callers can request environments
    with `scene` plus `timeOfDay` instead of only combined preset names.

- **Changed**
  - Pathtracer environment misses now resolve through non-null inferred
    environment radiance, and emissive material hits contribute once before
    terminating the active sample path.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.19] - 2026-06-03

- **Added**
  - Added `createEnvironmentLightingConfig(...)` and
    `createWavefrontEnvironmentLightingOptions(...)` so renderers and demos can
    consume lighting-owned environment presets without embedding local ambient
    or sky constants.
  - Concrete hybrid realtime WGSL kernels for `directLighting`,
    `screenTrace`, `radianceCache`, and `finalGather`.

- **Changed**
  - README now documents the delivered hybrid realtime kernel scope alongside
    the existing pathtracer and reflection-resolve stages.

- **Fixed**
  - Hybrid realtime technique exports no longer ship placeholder WGSL bodies
    for the direct-lighting, screen-trace, radiance-cache, and final-gather
    stages.

- **Security**
  - (placeholder)

## [0.1.17] - 2026-05-13

- **Added**
  - Added `createLightingProfileModeLadder()` plus default reference-first
    policy metadata so downstream runtimes can expose `reference`, `hybrid`,
    and `realtime` as governor-managed lighting modes with a `30` FPS, `4`
    frame adaptive window.
  - Replaced the placeholder `pathtracer` WGSL jobs with concrete path trace,
    accumulation, and denoise kernels plus a concrete hybrid
    `reflectionResolve` WGSL stage.

- **Changed**
  - Documented that the new reference-first ladder is a performance-planning
    contract for real renderers, and that the shipped WGSL kernels still
    require downstream renderer integration before they become a live RT frame
    path.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.16] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.15] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.14] - 2026-05-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Use an opaque URL constructor path for import metadata so Vite/Rolldown
    cannot inline the lighting module URL as a generated `data:` asset.

- **Security**
  - (placeholder)

## [0.1.13] - 2026-05-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Keep import metadata out of direct URL constructor calls so browser
    bundlers do not rewrite the lighting module base into a `data:` asset URL.

- **Security**
  - (placeholder)

## [0.1.12] - 2026-05-08

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Prevent browser bundlers from rewriting the lighting module base URL into a
    `data:` asset URL before technique WGSL URLs are constructed.

- **Security**
  - (placeholder)

## [0.1.11] - 2026-04-02

- **Added**
  - Demo contract tests that lock the shared 3D harbor mount options and the
    visible lighting state catalog surfaced by `gpu-lighting/demo/`.

- **Changed**
  - The browser demo now imports `@plasius/gpu-shared` through an import map
    and public package import instead of a deep internal `node_modules/.../dist`
    path.
  - README guidance now consistently describes the mounted 3D harbor demo
    instead of mixing in stale catalog-only text.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.10] - 2026-03-23

- **Added**
  - A browser-based 3D harbor demo so lighting band behavior is visible against
    GLTF ships, cloth, and water instead of a catalog-only page.

- **Changed**
- `gpu-lighting/demo/` now delegates its 3D harbor scene to the shared
    `@plasius/gpu-shared` showcase runtime instead of carrying a package-local copy
    of the renderer and loader logic.
  - The harbor runtime now renders stronger near-field shadow projection and
    reflection accents so the lighting bands read closer to the intended
    ray-traced lighting path.

- **Fixed**
  - The package-local lighting demo now gives a clear visual result instead of
    looking like a flat catalog surface.

- **Security**
  - (placeholder)

## [0.1.9] - 2026-03-15

- **Added**
  - ADR, TDR, and test-first planning coverage for distance-banded lighting and
    shadow-source strategy in the ray-tracing-first renderer.
  - Added `createLightingBandPlan(...)` and public near/mid/far/horizon
    lighting-band exports.
  - Added tests covering explicit banded shadow sources, RT participation
    scaling, cadence policy, and horizon impression behavior.

- **Changed**
  - Profile worker manifests now publish `lightingBands`, and technique worker
    jobs now carry ray-tracing-first quality dimension metadata for downstream
    `@plasius/gpu-performance` integrations.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.8] - 2026-03-14

- **Added**
  - (placeholder)

- **Changed**
  - Raised the minimum `@plasius/gpu-worker` dependency to `^0.1.10` so npm
    installs resolve the published DAG-ready worker runtime by default.
  - Updated GitHub Actions workflows to run JavaScript actions on Node 24,
    refreshed core workflow action versions, and switched Codecov uploads to
    the Codecov CLI.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.7] - 2026-03-13

- **Added**
  - Worker governance manifests and bundle loaders that align lighting jobs with
    `gpu-worker`, `gpu-performance`, and `gpu-debug` integration contracts.
  - ADR, TDR, and design documentation for worker-first lighting integration.
  - DAG scheduler metadata for lighting manifests, including priorities and
    inter-job dependencies per technique.

- **Changed**
  - README now documents lighting worker manifests, performance budget ladders,
    DAG metadata, and debug metadata expectations for consumers.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.6] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-03-01

- **Added**
  - `lint`, `typecheck`, and security audit scripts for local and CI enforcement.

- **Changed**
  - CI now fails early on lint/typecheck/runtime dependency audit before build/test.

- **Fixed**
  - Pack-check regex cleanup to remove an unnecessary path escape.

- **Security**
  - Runtime dependency vulnerability checks are now enforced in CI.

## [0.1.1] - 2026-02-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.0] - 2026-02-10

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.0] - 2026-02-10

- **Added**
  - Lumen-inspired hybrid realtime lighting technique scaffold.
  - Path-traced reference, volumetric lighting, and HDRI/IBL technique catalogs.
  - Loader APIs for technique WGSL modules and profile-driven planning.
  - ADR set documenting the advanced lighting architecture.


[0.1.0]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.0

## [0.1.0] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[0.1.1]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.2
[0.1.6]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.6
[0.1.7]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.7
[0.1.8]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.8
[0.1.9]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.9
[0.1.10]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.10
[0.1.11]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.11
[0.1.12]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.12
[0.1.13]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.13
[0.1.14]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.14
[0.1.15]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.15
[0.1.16]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.16
[0.1.17]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.17
[0.1.19]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.1.19
[Unreleased]: https://github.com/Plasius-LTD/gpu-lighting/compare/v0.2.6...HEAD
[0.2.0]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.2.0
[0.2.2]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.2.2
[0.2.6]: https://github.com/Plasius-LTD/gpu-lighting/releases/tag/v0.2.6
