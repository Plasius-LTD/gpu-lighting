# ADR-0010: Physical Fixed-SPP Baseline as the Adaptive Admission Reference

## Status

Accepted

- Date: 2026-08-31
- Version: 1.0

## Context

The GPU-native adaptive path-sampling feature must demonstrate reduced total
GPU render-job time at matched image quality without changing the disabled
fixed-SPP path. Comparisons made from one frame, wall-clock time alone, or an
incomplete scene/resolution matrix cannot distinguish a real improvement from
timing noise, missing work, or a stability failure.

`@plasius/gpu-renderer` owns transport and exact frame telemetry.
`@plasius/gpu-debug` owns passive bounded aggregation. `@plasius/gpu-lighting`
owns representative physical reference scenes and is therefore the correct
place to retain the fixed-path qualification matrix.

Three.js is permanently prohibited and must never be used as an implementation,
capture, comparison, compatibility, fallback, or rollback path.

## Decision

Adaptive sampling admission uses a retained physical-WebGPU fixed-SPP baseline
with these mandatory dimensions:

- four scene families: environment-heavy, outdoor silhouette, Eames indoor,
  and geometry-heavy;
- 1080p, 1440p, and 4K;
- one, four, and eight maximum bounces;
- 4, 32, and 128 SPP;
- denoise disabled and enabled.

Every one of the 216 lanes excludes warm-up frames and retains repeated
measurements. The runner fails closed unless exact ray counts, timestamp-query
GPU time, total render-job time, memory, queue-overflow, device-loss, and
transport-guardrail evidence are present and internally consistent.

Capture provenance is stored on each lane before it can be resumed. Source
revision, package versions, browser, adapter, and capture date are mandatory;
raw measurements and derived statistics are revalidated on resume. Source and
package identity are checked before and after each capture. A manifest cannot
apply a later runtime identity to previously captured measurements. Schema-1
evidence without those identities is historical only and must be recaptured.

Each lane publishes the sample coefficient of variation and a two-sided 95%
Student t interval. A later adaptive mode may advance only when the lower 95%
confidence bound for matched-quality GPU-time improvement is at least
`max(5%, 2 × baseline coefficient of variation)`.

The fixed path remains the release rollback. No rollback may restore a
prohibited renderer dependency.

## Alternatives Considered

- A small smoke matrix is useful for development but cannot qualify the full
  resolution, depth, SPP, scene, and denoise envelope.
- Wall-clock-only measurements remain useful when timestamps are unavailable,
  but are insufficient for this physical baseline because queue and host noise
  are not GPU execution time.
- A synthetic telemetry fixture verifies statistics and fail-closed admission,
  but cannot replace physical WebGPU evidence.

## Consequences

- Adaptive claims have a stable, versioned comparison reference and an
  explicit noise-dependent advancement floor.
- Captures are expensive, so lane evidence is resumable and retained
  independently before manifest assembly.
- Devices without timestamp-query support cannot produce qualifying baseline
  evidence; they may still run unit and smoke checks.
- Fixed-path regressions, missing evidence, queue overflow, and device loss are
  release-blocking rather than silently omitted.

## Related Decisions

- [ADR-0002](./adr-0002:%20Path-Traced%20Reference%20Rendering%20Mode.md)
- [ADR-0008](./adr-0008:%20Renderer-Aligned%20Wavefront%20Lighting%20Jobs.md)
- [TDR-0003](../tdrs/tdr-0003-fixed-spp-baseline-capture-and-statistics.md)

## References

- `Plasius-LTD/plasius-ltd-site#2116`
- `Plasius-LTD/gpu-lighting#85`
