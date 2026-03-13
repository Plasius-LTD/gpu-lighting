# Architectural Decision Record (ADR)

## Title

Worker-First Lighting Governance Manifest

---

## Status

- Accepted
- Date: 2026-03-13
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

---

## Tags

worker, performance, debug, lighting

---

## Context

`@plasius/gpu-lighting` already ships WGSL techniques for use with
`@plasius/gpu-worker`, but first-wave rollout now requires lighting packages to
express worker-job budgets and debug metadata in a form that consumers can wire
into `@plasius/gpu-performance` and `@plasius/gpu-debug`.

---

## Decision

Publish a worker governance manifest per lighting technique and profile.

Each manifest records:

- stable `jobType` values aligned with worker job labels,
- queue-class ownership for scheduling and debugging,
- `schedulerMode`, `priority`, and `dependencies` when lighting jobs form an
  ordered DAG,
- suggested performance budget ladders for worker-budget adapters,
- opt-in debug metadata such as owner, tags, and suggested allocation ids.

---

## Alternatives Considered

- **Leave governance in downstream apps only**: increases duplication and makes
  package-level rollout inconsistent.
- **Depend directly on gpu-performance and gpu-debug runtime APIs**: would add
  unnecessary package coupling before those integrations stabilize.

---

## Consequences

- Consumers can assemble WGSL and governance metadata from one package surface.
- Lighting jobs remain framework-agnostic while still aligning to the shared
  worker/performance/debug model.
- Multi-stage lighting passes can preserve critical ordering without requiring
  downstream apps to rebuild dependency graphs.
- Manifest presets will need tuning as real workloads mature.

---

## Related Decisions

- ADR-0001: Lumen-Inspired Hybrid Realtime Lighting
- ADR-0002: Path-Traced Reference Rendering Mode
- ADR-0003: Froxel Volumetric Lighting Pipeline
- ADR-0004: HDRI-First Physical Lighting and Exposure

---

## References

- `@plasius/gpu-worker`
- `@plasius/gpu-performance`
- `@plasius/gpu-debug`
