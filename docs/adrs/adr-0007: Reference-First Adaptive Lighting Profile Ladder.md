# ADR-0007: Reference-First Adaptive Lighting Profile Ladder

## Status

Accepted

## Context

`@plasius/gpu-lighting` already exposes `realtime`, `hybrid`, and `reference`
profiles, but downstream runtimes still need an explicit contract for when the
premium `reference` profile should be attempted and when it should step down.

Recent high-end GPUs may be able to hold a reference-first mode at interactive
rates for some scenes, especially in constrained demos or lighter gameplay
views. The performance package already owns the adaptive control loop, so the
lighting package should publish a stable profile ladder that those runtimes can
hand directly to `@plasius/gpu-performance`.

At the same time, the current pathtracer WGSL files remain placeholder kernels.
The policy contract must not overstate that implementation status.

## Decision

`@plasius/gpu-lighting` will publish a public adaptive profile ladder contract
through `createLightingProfileModeLadder()`.

The default policy is:

- start from `reference`
- use a `4`-frame adaptation window
- target a `30` FPS floor for keeping `reference`
- degrade whole-profile quality in this order:
  - `reference`
  - `hybrid`
  - `realtime`

The exported ladder includes:

- ordered profile levels for governor integration
- a recommended frame-target contract
- a recommended adaptation-window contract
- per-level band-planning metadata so renderers can switch profile and lighting
  participation together

## Consequences

- Positive: the demo, the game, and future renderers can all share one stable
  reference-first adaptive policy.
- Positive: high-end devices can legitimately attempt `reference` mode first
  instead of treating it as offline-only by default.
- Positive: profile-level degradation becomes explicit and testable rather than
  ad hoc.
- Neutral: this ADR defines runtime governance only; it does not claim the
  placeholder `pathtracer` kernels are already complete realtime ray tracing.
- Negative: downstream runtimes still need real renderer execution support
  before this policy can deliver true path-traced pixels.

## Follow-On Work

- Replace placeholder `pathtracer` and hybrid reflection kernels with real WGSL
  implementations.
- Teach `@plasius/gpu-renderer` to consume the adaptive lighting profile ladder
  alongside scene-band planning.
- Add image-based validation between `reference` and degraded runtime profiles
  once the real kernels exist.
