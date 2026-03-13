# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - Worker governance manifests and bundle loaders that align lighting jobs with
    `gpu-worker`, `gpu-performance`, and `gpu-debug` integration contracts.
  - ADR, TDR, and design documentation for worker-first lighting integration.

- **Changed**
  - README now documents lighting worker manifests, performance budget ladders,
    and debug metadata expectations for consumers.

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
