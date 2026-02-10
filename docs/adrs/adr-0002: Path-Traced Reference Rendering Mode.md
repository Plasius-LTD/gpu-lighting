# Architectural Decision Record (ADR)

## Title

Path-Traced Reference Rendering Mode

---

## Status

- Accepted
- Date: 2026-02-10
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

---

## Tags

path-tracing, validation, rendering, monte-carlo, quality

---

## Context

Hybrid realtime lighting requires a quality baseline to tune bias/noise and
validate correctness of GI, reflections, and material response. Without a
reference mode, quality regressions are hard to diagnose and comparisons remain
subjective.

---

## Decision

Provide a dedicated `pathtracer` technique for reference rendering with:

- Progressive path tracing pass.
- Frame accumulation pass.
- Denoise pass placeholder for integration.

This mode is included in the `reference` profile and is used for quality checks
against the realtime `hybrid` path.

---

## Alternatives Considered

- **No reference path**: simpler implementation but poor quality governance.
- **Offline external renderer only**: useful for final images, but weak for
  in-engine pass-by-pass debugging.
- **Single-path implementation only**: reduces code paths but blocks realtime
  performance goals.

---

## Consequences

- Improves visual QA and tuning confidence for realtime features.
- Increases maintenance cost for dual-path rendering support.
- Enables automated and manual A/B image checks in future CI workflows.

---

## Related Decisions

- ADR-0001: Lumen-Inspired Hybrid Realtime Lighting
- ADR-0004: HDRI-First Physical Lighting and Exposure

---

## References

- Monte Carlo path tracing literature and production renderer practice.
