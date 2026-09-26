# Native full-frame screen — 26 September 2026

**Result: the current fixed32 path fails the native 1080p/60 Hz minimum.**
Native 4K also exceeds the 16.6667 ms frame budget. This is a shortfall screen,
not sustained performance or image-quality qualification and not an adaptive
before/after comparison. No publication speedup or memory-saving claim follows.

Tracked by [gpu-lighting#87](https://github.com/Plasius-LTD/gpu-lighting/issues/87),
[gpu-renderer#169](https://github.com/Plasius-LTD/gpu-renderer/issues/169) and
[Feature site#2114](https://github.com/Plasius-LTD/plasius-ltd-site/issues/2114).
The [native-resolution acceptance contract](../native-resolution-acceptance.md)
remains mandatory. All rollout flags remain unchanged/default off; Three.js is
prohibited and cannot be a fallback.

## Capture and scope

- Apple M2 Max MacBook Pro (Mac14,5), 32 GB unified memory; host hardware identity
  checked locally with serial/UUID fields excluded. Browser exposes the physical
  non-fallback Apple `metal-3` adapter, not an exact physical core count.
- In-app browser, foreground throughout the measured frames. Browser build,
  thermal/power conditions and physical display cadence were not captured; this
  is not controlled sustained qualification.
- Renderer source
  [`343d61e2148184185019833441e4212e6c0cec77`](https://github.com/Plasius-LTD/gpu-renderer/commit/343d61e2148184185019833441e4212e6c0cec77),
  lighting source
  [`4cfcc6dfaf9275eaa69a5add212125b624ee25b0`](https://github.com/Plasius-LTD/gpu-lighting/commit/4cfcc6dfaf9275eaa69a5add212125b624ee25b0).
  Source modules were served from immutable Git objects, not live working files.
- Actual renderer/canvas/PNG dimensions are 1920×1080 and 3840×2160. CSS preview
  sizing does not reduce the render resolution. Tile size is 128×128.
- Lighting-owned `diffuse-silhouette` scene: six triangles, including two emissive
  triangles, and procedural environment. This is not Eames or the full site scene.
- Fixed 32 SPP, four-bounce ceiling, denoise off, deferred resolve on, strict
  physical low-SPP lighting on. Frame-time budget zero and minimum SPP 32; no
  frame-budget reduction, motion policy, per-pixel adaptation or history.
- One warmup followed by three measured full frames at each resolution. Timed
  spans cover the complete render promise: preparation, all tiles, command
  submission/completion and GPU presentation commands. Setup/compilation,
  post-run PNG/receipt retention, application work and compositor/physical display
  delivery are outside this span.
- CPU profiling, statistics and probe readback are disabled in the timed lane.
  GPU-only timing, actual GPU-completed counts/rays/segments and overflow are
  **unmeasured**, not zero. `renderedSpp: 32` is host scheduling metadata, not
  independently read-back completed counts. The redundant per-frame `targetSpp`
  key is absent in these receipts; configured/requested 32 and host-rendered 32
  are retained separately at lane/snapshot and frame level.

## Corrected run

Capture `native-frame-2026-09-26T11-16-18-361Z`, combined receipt
`native-summary-1790421434049.json`, status `screened-not-qualified`, no recorded
validation/device errors or failed lanes.

| Metric | Native 1080p | Native 4K |
| --- | ---: | ---: |
| Warmup (ms) | 2,490.90 | 9,062.90 |
| Measured full frames (ms) | 2,347.40 / 2,383.20 / 2,295.60 | 8,978.10 / 8,984.20 / 8,938.10 |
| Mean complete render job (ms) | **2,342.07** | **8,966.80** |
| p50 (ms) | 2,347.40 | 8,978.10 |
| p95 / p99 / maximum (ms) | 2,383.20 | 8,984.20 |
| Frames missing 16.6667 ms | 3 / 3 | 3 / 3 |
| Renderer throughput upper bound (1000 / mean, frames/s) | 0.427 | 0.112 |
| Tiles / frame | 135 | 510 |
| Command submissions / frame | 136 | 511 |
| Direct / indirect dispatch commands | 25,920 / 34,560 | 97,920 / 130,560 |
| Total dispatch commands / frame | 60,480 | 228,480 |
| Estimated hot-buffer bytes | 15,086,180 | 21,230,180 |
| Of which frame-configuration bytes | 2,211,840 | 8,355,840 |

With only three observations, nearest-rank p95 and p99 are just the maximum;
they are not reliable sustained tail estimates. The reciprocal mean is a
renderer throughput upper bound, not measured physical display FPS. Receipt
`gpuWorkerJobs` counts dispatch commands, **not rays or path segments**.

Tile-bounded queue-pair (3,145,728 bytes), hit (4,194,304), accumulation (262,144)
and path-vertex (5,242,880) storage are unchanged between these resolutions.
The hot-buffer estimate excludes textures, total assets, staging/driver memory
and physical residency. It is neither complete memory accounting nor exact VRAM.

## Adapter-consumption failure retained

The initial capture `native-frame-2026-09-26T11-13-11-035Z`, renderer
`c42efa91297f335c5c8d2760bb924d61daaaa2cd`, completed its 1080p lane but failed
before 4K device creation because the fixture reused an already-consumed adapter.
Its combined receipt is `native-summary-1790421213351.json`; status is `failed`.
The partial 1080p mean was 2,321.90 ms. It is **not pooled** with the corrected run
or accepted as a complete two-resolution run.

The fixture now obtains a fresh adapter before each independent renderer/device.
Regression tests use a fake adapter that rejects a second device request, and
check cancellation, unavailable/fallback adapters and failed-lane short circuit.
Both physical resolutions subsequently completed using this fix. Transport,
renderer scheduling and shader code were not changed for this repair.

## Retained artifacts and checks

[Raw receipt/PNG archive](native-resolution-2026-09-26.tar.gz), SHA-256:
`05bd50d4f566258f2a7ff6b79126631d6cbcfda222af814c86ab6f40712d281e`.
It includes both runs, every warmup/measured timing and snapshot, failed-run
reason, native display PNGs, summary PNGs and served-source hashes. Display PNGs
are illustrative, not linear-HDR correctness evidence.

Independent verification compared every recorded source hash with the named Git
object, recomputed summaries from raw frame times with the lighting-owned screen,
checked native canvas/snapshot/PNG dimensions, visibility and fixed32 metadata,
and verified submission/tile agreement. No raw timing or rejected evidence was
edited. The archive does not upgrade the previously rejected baseline schema-1
benchmark into admissible qualification.

To repeat, serve renderer commit `343d61e` at `/src/` and `/tests/fixtures/`,
lighting commit `4cfcc6d` at `/lighting/`, and provide the existing local capture
bridge plus `/__provenance` with both full commits and a unique capture ID. Open
`/tests/fixtures/native-frame-screen.html` with physical WebGPU and run the native
screen. Check the retained source hashes, raw dimensions and failed-lane list
before interpreting timings. Do not substitute the single-tile adaptive fixture.

Local validation: renderer 297 tests / 96.00% line coverage; lighting 131 tests /
80.30% line coverage, with the new native timing module at 100% lines/branches.
Lint, type/syntax and package/dependency checks pass, including all nine
Zero-Three checks in each repository. No quality threshold was lowered. Post-push
CI/review and applicable main/CD gates remain separate, required delivery gates.

## Next evidence needed

The shortfall is orders of magnitude, not a near-60-Hz result. Profile native
CPU encoding/submission and GPU stages separately before attributing it to CPU,
GPU or tile synchronization. The measured 60,480/228,480 dispatch commands and
136/511 submissions identify concrete investigation targets; counts alone do not
establish their timing share or a promised speedup.

Complete the multi-tile adaptive integration, then compare it against the same
fixed scene, resolution and frozen quality requirements, retaining independent
and combined policy modes. Follow with representative scenes, actual-count and
ray diagnostics, linear-HDR errors, the full matrix and sustained application/
display evidence. Neither this screen nor the older 128×128 probes satisfies
the real-time milestone or permits updating the white paper with speedup claims.
