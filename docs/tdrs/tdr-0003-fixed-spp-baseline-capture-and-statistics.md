# TDR-0003: Fixed-SPP Baseline Capture and Statistics

## Status

Accepted

- Date: 2026-08-31
- Version: 1.0

## Scope

This record governs construction, capture, admission, aggregation, retention,
and reporting of the fixed-SPP baseline used by the adaptive path-sampling
programme.

## Context

The renderer now exposes exact ray, timestamp, memory, stability, and transport
telemetry. The lighting package already owns the physical validation page and
reference scene catalog. The missing piece was a deterministic matrix runner
that could prove the fixed path, quantify timing variance, and stop incomplete
evidence from becoming a baseline.

## Design

`fixed-spp-baseline-capture.mjs` constructs the complete 216-lane cross product.
Each lane renders two warm-up frames followed by ten measurements by default.
The page requests renderer statistics without changing sample scheduling and
returns one compact complete frame record per render.

The capture server maps the `/gpu-lighting/` route to the active package root.
Sibling `/gpu-*` routes prefer the active package's installed, lockfile-selected
package graph and fall back to the workspace root only when a sibling is not
installed. This makes branch and worktree captures qualify the active change
against its exact released dependencies rather than whichever revision happens
to be checked out in a canonical sibling directory. Qualifying baseline runs
start their own server and never reuse an unverified listener on the capture
port. Full-matrix runs also reject a dirty source tree and retain the source
revision and participating package versions on each lane at capture time.
Each captured lane uses a fresh page. Resume verifies the captured source,
packages, browser, and adapter and recomputes statistics from raw frames.
Missing or changed identity is rejected before evidence can be reused.

Each measured frame is validated before bounded ingestion by
`@plasius/gpu-debug`. Warm-up frames remain in lane evidence but are excluded
from statistics and aggregates. Lane JSON is written immediately and can be
resumed. The final manifest is created only when every required lane passes.

For measured values `x[1..n]`, the runner calculates the arithmetic mean,
sample standard deviation with denominator `n - 1`, coefficient of variation
`s / mean`, and a two-sided 95% Student t confidence interval. At least two
measurements are required.

## Data Contracts

The qualifying manifest schema version is `2` (frame payloads remain `1`):

- lane: mode, scene, resolution, maximum depth, SPP, denoise state, warm-up
  count, and measurement count;
- frame: exact primary/secondary/total segment counts, bounce histogram,
  timestamp-query and render-job timings, telemetry and renderer memory,
  queue overflow, device-loss state, and transport guardrails;
- lane result: measurements, statistics, bounded debug snapshot, peak memory,
  stability summary, optional HDR probe, capture timestamp, source/package
  provenance, browser version, and adapter identity;
- manifest: complete ordered matrix, runtime/adapter identity, aggregate
  variance percentiles/maxima, and the required matched-quality improvement.

Missing lanes, missing timestamp evidence, inconsistent rays, adaptive budget
constraint, queue overflow, device loss, or failed guardrails reject the
manifest.

## Operational Considerations

- Reliability: lane-at-a-time retention and resume prevent a late failure from
  discarding prior physical evidence.
- Observability: terminal progress names the current lane; JSON retains all
  machine evidence and Markdown provides a review summary.
- Security: only loopback HTTP origins are accepted and request paths are
  constrained to the active package or workspace root.
- Cost: the full 4K/eight-bounce/128-SPP lanes are intentionally offline and
  may take substantial GPU time.

Three.js is permanently prohibited and must never be present in the runner,
page, dependency graph, evidence, or fallback path.

## Rollout and Migration

The runner lands while the adaptive parent flag remains disabled. Capture the
fixed baseline first, retain the manifest with its exact package revisions, and
use it for later matched-quality comparisons. Feature disable returns to the
unchanged GPU-native fixed path.

## Risks and Mitigations

- Thermal drift is mitigated with warm-up exclusion, repeated measurements,
  per-lane CV, and confidence intervals.
- Worktree/canonical checkout confusion is prevented by active-package route
  overlay and a package-root contract test.
- Partial runs are prevented from becoming evidence by exact matrix cardinality
  and manifest completeness checks.
- Unsupported timestamp queries fail qualification instead of substituting a
  less precise metric.

## Open Questions

None for the fixed-SPP baseline. Image-quality matching belongs to the later
adaptive comparison story.
