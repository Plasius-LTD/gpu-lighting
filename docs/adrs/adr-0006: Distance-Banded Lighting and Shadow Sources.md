# ADR-0006: Distance-Banded Lighting and Shadow Sources

## Status

Accepted

## Context

The ray-tracing-first renderer should not spend the same lighting and shadow
cost on every part of the world. The architecture explicitly calls for different
shadow and lighting sources by distance band while preserving continuity and
time-of-day readability.

`@plasius/gpu-lighting` already owns the premium lighting techniques, so it is
the right package to define the range-banded source strategy before the coding
phase starts.

## Decision

`@plasius/gpu-lighting` will plan around four lighting bands:

- `near`: premium shadows and lighting, with ray-traced shadows as the primary
  source for important lights and surfaces
- `mid`: mixed quality, using selective raster shadowing, regional shadow maps,
  proxy casters, and stronger temporal reuse
- `far`: coarse or proxy-driven shadowing with reduced RT participation and
  low-cost lighting continuity
- `horizon`: baked or far-field shadow impression only, treated as part of the
  distant representation rather than per-object dynamic truth

## Consequences

- Positive: shadow strategy becomes an explicit architecture rule instead of a
  late-stage fallback.
- Positive: renderer, lighting, and world-representation packages can share one
  vocabulary for distance-banded lighting.
- Positive: future ray-traced reflections and GI work can be budgeted by the
  same band system.
- Neutral: this ADR does not yet implement any particular lighting technique;
  it defines the contract those techniques should satisfy.

## Follow-On Work

- Define the technical contract for shadow source selection and lighting budget
  policy by band.
- Add test-first contract and unit specs before implementation starts.
