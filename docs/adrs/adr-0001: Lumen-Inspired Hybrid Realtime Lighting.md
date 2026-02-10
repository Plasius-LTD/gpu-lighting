# Architectural Decision Record (ADR)

## Title

Lumen-Inspired Hybrid Realtime Lighting

---

## Status

- Accepted
- Date: 2026-02-10
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

---

## Tags

lighting, gi, reflections, realtime, webgpu

---

## Context

The project needs a practical advanced realtime lighting path that captures core
benefits of Unreal Engine's Lumen-style approach: dynamic indirect lighting,
rough/specular reflections, and good visual stability under camera movement.
Pure path tracing is too expensive for the default runtime target, while pure
screen-space methods fail on off-screen geometry and large scene changes.

---

## Decision

Adopt a hybrid realtime pipeline named `hybrid` with these ordered stages:

- Direct lighting resolve.
- Screen-space tracing for first-hit reuse.
- Software trace fallback over scene acceleration structures.
- Radiance cache update.
- Final gather resolve with temporal reuse.
- Reflection resolve pass.

This becomes the default advanced realtime technique in
`@plasius/gpu-lighting` and is exposed via the technique catalog API.

---

## Alternatives Considered

- **Screen-space-only GI/reflections**: lower cost, but poor off-screen
  stability and missing data in many camera angles.
- **Full deferred + baked probes only**: stable and cheap, but weak for dynamic
  geometry and moving light sources.
- **Realtime full path tracing**: highest quality but currently too expensive as
  the default interactive mode.

---

## Consequences

- Provides a scalable realtime path with better quality/perf balance than
  screen-space-only pipelines.
- Requires temporal accumulation controls and history validation.
- Adds multiple passes and cache management complexity.

---

## Related Decisions

- ADR-0002: Path-Traced Reference Rendering Mode
- ADR-0003: Froxel Volumetric Lighting Pipeline
- ADR-0004: HDRI-First Physical Lighting and Exposure

---

## References

- Unreal Engine Lumen technical overviews.
- Realtime GI and reflections literature for hybrid tracing systems.
