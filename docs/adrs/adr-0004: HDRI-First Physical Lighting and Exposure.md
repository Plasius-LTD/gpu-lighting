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

Environment lighting configs also publish optional rectangular environment-light
portals. A portal represents a physical opening, such as a window or door, where
outside sky/HDRI radiance is available to an interior path tracer. The lighting
package owns the reusable semantics and normalization of these apertures,
including position, normal, tangent, dimensions, colour, radiance scale, and
guide/gate mode. Consuming renderers remain responsible for GPU upload,
visibility tests, ray continuation policy, and final integration.

Environment presets also publish scene/time-of-day metadata and normalized
light-source descriptors. Outdoor, interior, and underground preset families
(`grass-field`, `forest`, `warehouse`, and `cavern`) each expose dawn, midday,
dusk, and night variants. Each variant declares source kinds such as sun, moon,
sky, canopy transmission, fluorescent strips, cave mouth, torch, bioluminescent
fill, or lava fissures.

When a path ray misses scene geometry, renderers should treat the environment
sample as inferred light from the preset's dominant source metadata. The
contract must provide non-negative colour, radiance, luminance, direction, and a
stable `environment-miss` starting point so render validation never has to
interpret a null or negative colour space. Explicit emissive material hits
remain physical light-source hits and should terminate active sample paths
before environment inference is applied.

---

## Alternatives Considered

- **Constant ambient term only**: very low cost but non-physical and scene
  dependent.
- **Reflection probes without HDRI precompute**: partial result with weaker
  energy consistency.
- **Manual artist-only exposure tuning**: inconsistent and hard to automate.
- **Renderer-local window constants**: quick to prototype but duplicates
  lighting semantics and prevents product scenes from sharing one environment
  contract across renderers.
- **Preset names without light-source metadata**: easier to expose but leaves
  pathtracers guessing source colour and brightness on environment misses.

---

## Consequences

- Improves realism and consistency across lighting profiles.
- Allows interior renderers to constrain external environment contribution to
  real openings instead of treating the whole sky as visible from every bounce.
- Gives renderers deterministic environment-miss radiance metadata for render
  checks and path-tracing diagnostics.
- Adds precompute steps and asset preparation requirements.
- Creates a strong baseline for material validation in the path-traced mode.
- Adds a small shared data contract that renderers must map to their GPU buffer
  layouts.

---

## Related Decisions

- ADR-0001: Lumen-Inspired Hybrid Realtime Lighting
- ADR-0002: Path-Traced Reference Rendering Mode
- ADR-0003: Froxel Volumetric Lighting Pipeline

---

## References

- PBR/IBL best practices and ACES tone-mapping references.
