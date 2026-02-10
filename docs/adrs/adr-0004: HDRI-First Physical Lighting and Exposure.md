# Architectural Decision Record (ADR)

## Title

HDRI-First Physical Lighting and Exposure

---

## Status

- Accepted
- Date: 2026-02-10
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

---

## Tags

hdri, ibl, pbr, exposure, tone-mapping

---

## Context

Advanced GI and reflections require physically plausible environment lighting
and consistent exposure controls. Static ambient terms are not sufficient for
lookdev or cross-scene stability. The package needs a standard HDRI/IBL path to
support both realtime and reference rendering profiles.

---

## Decision

Adopt an HDRI-first pipeline (`hdri` technique) that includes:

- Irradiance convolution pass.
- Specular prefilter pass.
- BRDF LUT generation pass.

Pair this with physical exposure assumptions and ACES-compatible tone-mapping
at integration points in consuming runtimes.

---

## Alternatives Considered

- **Constant ambient term only**: very low cost but non-physical and scene
  dependent.
- **Reflection probes without HDRI precompute**: partial result with weaker
  energy consistency.
- **Manual artist-only exposure tuning**: inconsistent and hard to automate.

---

## Consequences

- Improves realism and consistency across lighting profiles.
- Adds precompute steps and asset preparation requirements.
- Creates a strong baseline for material validation in the path-traced mode.

---

## Related Decisions

- ADR-0001: Lumen-Inspired Hybrid Realtime Lighting
- ADR-0002: Path-Traced Reference Rendering Mode
- ADR-0003: Froxel Volumetric Lighting Pipeline

---

## References

- PBR/IBL best practices and ACES tone-mapping references.
