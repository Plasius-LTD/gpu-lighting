# ADR-0008: Renderer-Aligned Wavefront Lighting Jobs

## Status

Accepted

## Context

`@plasius/gpu-renderer` now owns the public wavefront queue layout, hit/surface
records, and terminal-hit policy for active-ray path tracing. The lighting
package still only exposed the older depth-first `pathtracer` WGSL entry points,
which meant downstream consumers had no lighting-owned shader tranche for the
renderer's breadth-first wavefront path.

Story `plasius-ltd-site#1039` required the first lighting slice where emissive
hits and environment misses terminate correctly through wavefront GPU jobs
without reintroducing a depth-first correctness dependency.

Story `plasius-ltd-site#1040` extends that contract with continuation-heavy
transport concerns: richer refraction/transparency handling, compact
medium-state carry, optional explicit-light probe semantics, and deterministic
CPU fixtures that stay comparable to renderer-owned buffers.

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

The continuation extension also publishes:

- medium-state helpers that preserve compact nested-medium payload state through
  refraction and transparency events
- visibility-probe ray helpers that reuse the base ray payload contract and
  distinguish probes through flag-encoded ray kinds
- probe contribution helpers with explicit `mis-balanced` and
  `exclusive-emissive` modes so active emissive hits cannot be double-counted
- deterministic reference fixtures with documented tolerances for CPU-vs-GPU
  comparisons

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
- Neutral: the package still does not own renderer-side queue orchestration for
  dedicated probe passes; it publishes the contract and deterministic reference
  behavior while renderer execution remains in `@plasius/gpu-renderer`.
- Negative: the package now carries both depth-first and wavefront path-tracing
  surfaces, so documentation and tests must keep the intended roles clear.

## Follow-On Work

- Promote the wavefront technique into a broader lighting profile once the
  remaining wavefront child stories are complete.
