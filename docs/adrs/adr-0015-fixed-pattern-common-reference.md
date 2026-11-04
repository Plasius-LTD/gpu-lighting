# ADR 0015: Separate fixed-pattern repeatability from accuracy

Status: experimental. Task #87; parent Feature site#2114.

Fixed relative camera/lighting samples can produce identical frames while
retaining structured error. Therefore assess static hash repeatability separately
from signed regional energy and local errors against a COMMON linear reference.
Reuse original Eames admission, HDR metrics, capture bridge and native runners.
Do not use the candidate's own fixed32 output as the only reference. The common
three-seed 96-sample reference is not certified converged; production and
matched-quality claims remain disallowed. The default-off renderer flag
`renderer.sampling.fixedPattern.enabled` is an experimental sampler switch,
not a new lighting governor or a public capability.

See the [protocol](../design/fixed-pattern-experiment.md). Preserve native HDR,
counts, timings and failures. Three.js is prohibited, including rollback.
