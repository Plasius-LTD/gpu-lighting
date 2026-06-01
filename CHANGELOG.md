# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - Concrete hybrid realtime WGSL kernels for `directLighting`,
    `screenTrace`, `radianceCache`, and `finalGather`.
  - `createWaterRayTraceLightingPlan()` for converting RT participation bands
    into renderer-facing water reflection and sampled soft-shadow pass metadata.
  - `createRayTracedShadowPostProcessPlan()` for converting direct RT shadow
    participation into scene-level shadow-mask and post-processed lighting
    metadata that avoids polygon shadow darkening.
  - Ultra-quality RT water and scene shadow plans now advertise per-pixel resolve
    passes with zero polygon shadow/reflection contribution.

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
