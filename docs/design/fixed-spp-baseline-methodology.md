# Fixed-SPP Baseline Methodology

## Purpose

This baseline records the unchanged GPU-native fixed-SPP path before adaptive
per-pixel scheduling is enabled. It establishes timing noise, transport work,
memory, and stability for later matched-quality comparisons. It does not enable
adaptive sampling and does not make an adaptive performance claim.

Three.js is permanently prohibited and must never be installed, bundled,
referenced by public types, used by tests, or selected as a fallback.

## Matrix

| Dimension | Values |
| --- | --- |
| Scene | environment-heavy HDRI; outdoor silhouette; Eames indoor; geometry-heavy materials |
| Resolution | 1920×1080; 2560×1440; 3840×2160 |
| Maximum bounces | 1; 4; 8 |
| SPP | 4; 32; 128 |
| Denoise | off; on |

The full Cartesian product is 216 lanes. Static cameras and deterministic frame
index 777 are used. The feature parent flag
`renderer.sampling.adaptivePerPixel.enabled` remains disabled.

## Running and resuming

```bash
npm run build
npm run baseline:fixed-spp
```

The default output is `output/benchmarks/fixed-spp/task-85/`. Every lane is
written to `lanes/<lane-id>.json` as soon as it passes. Each capture uses a fresh
page. A rerun reuses a lane only when its configuration, clean source revision,
package versions, browser identity, and adapter match the current run. Its raw
frames are revalidated and its derived statistics recomputed before reuse.
Missing or changed provenance fails closed. Use a new output directory to
preserve the prior evidence when recapturing; `PLASIUS_FIXED_SPP_BASELINE_RESUME=0`
explicitly requests replacement of existing lane records.

The quick matrix is a physical smoke test only:

```bash
PLASIUS_FIXED_SPP_BASELINE_MATRIX=quick npm run baseline:fixed-spp
```

Quick-run frame counts can be overridden with
`PLASIUS_FIXED_SPP_BASELINE_WARMUPS` and
`PLASIUS_FIXED_SPP_BASELINE_REPETITIONS`. Qualifying evidence uses the default
two warm-ups and ten measurements; full mode rejects changes to that matrix.

## Frame admission

A frame passes only when all of the following are true:

- width, height, maximum depth, and requested/rendered SPP exactly match;
- the frame is not budget-constrained;
- primary rays equal `width × height × SPP`;
- secondary rays, total path segments, and the bounce histogram agree;
- GPU timestamp-query and total render-job time are available;
- telemetry and renderer hot-buffer memory are present;
- queue overflow is zero and device loss was not detected;
- renderer transport guardrails pass or retain an explicit warning.

No missing value is inferred. A device without qualifying timestamp support
fails closed.

## Statistics and adaptive admission

Warm-up frames are retained for audit but excluded from timing statistics.
Measured frames publish sample mean, sample standard deviation, coefficient of
variation, and a two-sided 95% Student t interval.

For every future adaptive comparison, image quality must first match the fixed
reference using the HDR and energy criteria owned by the image-regression
story. The timing claim then passes only when:

```text
lower 95% confidence bound for matched-quality GPU-time improvement
  >= max(5%, 2 × baseline coefficient of variation)
```

Primary rays and total path segments are reported alongside time so reduced
time cannot hide missing transport. Denoise-off is the primary correctness
lane; denoise-on is supplemental presentation evidence.

## Evidence artifacts

- `manifest.json`: runtime identity, all lanes/results, aggregate variance, and
  advancement floor;
- `summary.md`: human-readable lane table and headline statistics;
- `lanes/*.json`: resumable per-lane frame and runtime evidence.

The manifest is valid only at 216 of 216 passing lanes. Review evidence must
identify the exact source revision and released sibling package versions.
The runner enforces this by rejecting a dirty source tree and recording the
Git revision plus every participating `@plasius/gpu-*` package version on each
lane at capture time. Browser and adapter identities are retained per lane and
in the assembled manifest. Schema 2 is required for qualifying evidence.

Verify the full artifact without recapturing:

```bash
node scripts/eames-environments/fixed-spp-baseline-capture.mjs --verify /absolute/path/manifest.json
```

The schema-1 capture completed on 2026-09-01 retained 216 lanes but omitted
per-lane source/package identity. Its final manifest applied current package
versions to resumed measurements. It is historical diagnostic evidence only:
its reported pass and 52.22% advancement floor do not qualify an adaptive mode.
The original files are preserved, and qualifying evidence requires a fresh
schema-2 capture. See [the evidence audit](./fixed-spp-baseline-evidence-audit.md).
