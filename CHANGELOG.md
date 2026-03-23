# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

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
