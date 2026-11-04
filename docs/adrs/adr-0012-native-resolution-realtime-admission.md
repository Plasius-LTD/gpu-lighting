# ADR 0012: Native-resolution real-time admission

Date: 2026-09-26. Status: Accepted requirement; performance not yet qualified.
Feature site#2114, Story site#2125, Task gpu-lighting#87; renderer Task #169.

The user requires native 1080p at sustained 60 Hz on the M2 Max MacBook Pro as
the minimum acceptable result; 4K at 60 Hz is the ideal. Diagnostic 128×128
observations cannot admit performance/publication claims, even by extrapolation.

Retain small probes for correctness, but separate native-resolution absolute
frame-budget admission from the existing matched-quality relative improvement
gate. Both are required. No relaxation of image/energy criteria or hidden output
scaling, SPP reductions or stale-frame reuse to pass timing. Include full renderer
and application/presentation costs, tails and missed deadlines; GPU-only or mean
time is insufficient.

Lighting owns the protocol/statistics and reuses its existing timing module.
Renderer owns the physical full-frame fixture and unchanged tiled transport.
Short fixed32 native screens can identify a shortfall, never establish success;
missing quality/display/sustained evidence remains unqualified. The experimental
single-tile adaptive runner is not a full-frame implementation and cannot be
silently enlarged without proper tiled addressing/ownership validation.

No runtime or feature enablement changes. The parent remote adaptive flag remains
default off; the acceptance requirement itself is unconditional. Three.js is
prohibited. Rollback stays fixed GPU-native rendering, not a lower evidence bar.

See [protocol and requirements-first tests](../native-resolution-acceptance.md).
