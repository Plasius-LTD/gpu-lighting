# Architectural Decision Record (ADR)

## Title

Froxel Volumetric Lighting Pipeline

---

## Status

- Accepted
- Date: 2026-02-10
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

---

## Tags

volumetrics, fog, atmosphere, froxel, realtime

---

## Context

Atmospheric depth and light shafts are required for modern lighting quality,
especially when combined with dynamic GI and HDRI environments. A volumetric
solution must remain compatible with realtime budgets and integrate with both
hybrid and reference profiles.

---

## Decision

Use a froxel-grid volumetric approach (`volumetrics` technique) with staged
integration:

- Froxel lighting integration pass.
- Volumetric shadow resolve pass.

This approach is profile-enabled in `realtime` and `reference` profiles.

---

## Alternatives Considered

- **Simple height fog only**: cheap but insufficient for light shafts and local
  volumetric variation.
- **Full multi-scattering volumetric simulation**: high quality but too costly
  for baseline realtime targets.
- **Post-process fog without lighting coupling**: limited realism and weak GI
  interaction.

---

## Consequences

- Provides scalable atmospheric lighting with predictable GPU cost.
- Requires froxel resolution tuning and temporal filtering work.
- Establishes a path for later higher-order scattering upgrades.

---

## Related Decisions

- ADR-0001: Lumen-Inspired Hybrid Realtime Lighting
- ADR-0004: HDRI-First Physical Lighting and Exposure

---

## References

- Realtime froxel volumetric techniques in contemporary game engines.
