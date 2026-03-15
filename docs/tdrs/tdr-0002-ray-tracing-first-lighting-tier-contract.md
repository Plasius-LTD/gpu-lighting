# TDR-0002: Ray-Tracing-First Lighting Tier Contract

## Status

Accepted

## Goal

Define the future contract for distance-banded lighting and shadow selection in
`@plasius/gpu-lighting`.

## Planned Tier Model

Lighting profiles should be able to describe, at minimum:

- band:
  - `near`
  - `mid`
  - `far`
  - `horizon`
- primary shadow source
- assist or fallback shadow source
- RT participation policy for:
  - direct shadows
  - reflections
  - GI or indirect light
- temporal reuse expectations
- update cadence expectations

## Planned Shadow Sources By Band

- `near`: ray-traced shadows as the premium source, optionally assisted by
  raster visibility paths
- `mid`: selective raster shadow maps, regional coverage, and proxy casters
- `far`: HLOD or merged-caster shadows, coarse directional coverage, and
  low-frequency updates
- `horizon`: baked or shell-level shadow impression only

## Planned Tests

Contract tests should prove that:

- each lighting band declares a primary shadow source
- RT participation can scale independently for shadows, reflections, and GI
- temporal reuse policy is explicit for non-near bands

Unit tests should prove that:

- near-field lighting retains premium RT behavior
- mid and far bands can fall back to cheaper shadow sources without losing the
  band contract
- horizon lighting is represented as a far-field impression rather than a live
  per-object shadow system

## Implementation Notes

The first public implementation now ships as `createLightingBandPlan(...)`,
with `getLightingProfileWorkerManifest(...)` also exposing `lightingBands`.
The package now publishes explicit banded shadow sources, independent RT
participation policy for shadows/reflections/GI, and explicit temporal reuse
plus update cadence metadata.
