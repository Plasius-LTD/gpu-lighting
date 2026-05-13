# Pathtracer And Reflection Kernel Implementation

## Goal

Replace the placeholder WGSL in the `pathtracer` and hybrid
`reflectionResolve` jobs with real shader logic that downstream runtimes can
integrate into a true ray-tracing-first renderer.

## Scope

- `src/techniques/pathtracer/pathtrace.job.wgsl`
- `src/techniques/pathtracer/accumulate.job.wgsl`
- `src/techniques/pathtracer/denoise.job.wgsl`
- `src/techniques/hybrid/reflection-resolve.job.wgsl`

## Constraints

- `@plasius/gpu-lighting` is a WGSL catalog and planning package, not the final
  renderer runtime.
- The package can define concrete kernels, frame/state structs, and expected
  storage bindings, but it cannot by itself prove that hardware RT is active in
  a consumer.
- The implementation must stay consistent with the existing worker-manifest and
  technique catalog contracts.

## Proposed Implementation

### Pathtrace job

- Add explicit frame/state structs for camera rays, path-state storage,
  accumulation targets, and scene inputs.
- Implement per-pixel jittered sampling.
- Trace primary rays against a minimal scene contract:
  - ground plane
  - analytic spheres
  - triangle data hooks for future geometry feeds
- Support configurable bounce depth and throughput accumulation.
- Produce sky/environment fallback when no hit is found.

### Accumulate job

- Blend the current path-traced sample into a history buffer.
- Reset accumulation on camera or frame-state invalidation.
- Track sample counts per pixel so downstream denoise and tone-map stages know
  the effective convergence level.

### Denoise job

- Replace the placeholder with a spatial-temporal filter that consumes the
  accumulation buffer plus simple normal/depth guidance.
- Keep the first version compact and deterministic rather than attempting a full
  production SVGF implementation immediately.

### Reflection resolve job

- Replace the placeholder with a hybrid resolve that:
  - reads traced reflection hits and roughness response
  - falls back to sky/environment lighting when no valid hit exists
  - applies roughness-aware blur and intensity shaping
- Keep the resolve logic compatible with the existing `hybrid` technique order.

## Validation

- Add tests that fail if these jobs regress back to placeholders.
- Assert the new kernels expose expected structs, bindings, and bounce/sample
  controls.
- Run package lint, typecheck, coverage, and build after the WGSL updates.

## Non-Goals

- Full renderer-side acceleration structure construction in this package.
- Claiming production-ready realtime path tracing before `@plasius/gpu-renderer`
  consumes these kernels end-to-end.
