# ADR-0008: Renderer-Aligned Wavefront Lighting Jobs

## Status

Accepted

## Context

`@plasius/gpu-renderer` now owns the public wavefront queue layout, hit/surface
records, and terminal-hit policy for active-ray path tracing. The lighting
package still only exposed the older depth-first `pathtracer` WGSL entry points,
which meant downstream consumers had no lighting-owned shader tranche for the
renderer's breadth-first wavefront path.

Story `plasius-ltd-site#1039` requires the first lighting slice where emissive
hits and environment misses terminate correctly through wavefront GPU jobs
without reintroducing a depth-first correctness dependency.

## Decision

`@plasius/gpu-lighting` will add a public `wavefront` technique that is aligned
to the renderer-owned contracts rather than inventing a second queue model.

This slice publishes:

- the same queue-pair strategy and buffer contract names used by
  `@plasius/gpu-renderer`
- a lighting-owned plan helper, `createWavefrontLightingPlan()`, that makes the
  required renderer pass order and lighting-owned passes explicit
- concrete WGSL jobs for:
  - `accumulateTerminalRadiance`
  - `scatterContinuations`
- JS reference helpers for deterministic emissive/environment termination and
  continuation-event validation

The existing depth-first `pathtracer` technique remains available as a
reference-mode baseline. The new wavefront technique is an additive public
surface for renderer integration and validation.

## Consequences

- Positive: `gpu-lighting` now owns the first renderer-consumable wavefront
  lighting tranche instead of forcing downstream packages to reuse
  depth-first-only WGSL.
- Positive: contract drift between `gpu-renderer` and `gpu-lighting` becomes
  testable via shared queue/buffer/termination expectations.
- Positive: deterministic CPU-side helpers make emissive-hit, environment-hit,
  miss-darkening, and continuation behavior testable without a WebGPU runtime.
- Neutral: this slice only covers terminal radiance and continuation scattering;
  it does not yet own explicit light sampling, MIS weighting, or medium-heavy
  transport orchestration beyond the published hooks.
- Negative: the package now carries both depth-first and wavefront path-tracing
  surfaces, so documentation and tests must keep the intended roles clear.

## Follow-On Work

- Extend the wavefront slice with explicit light sampling and MIS once the
  renderer-owned queue orchestration is ready for that path.
- Add richer medium-aware continuation and attenuation once the lighting slice
  consumes fuller medium contracts.
- Promote the wavefront technique into a broader lighting profile once the
  remaining wavefront child stories are complete.
