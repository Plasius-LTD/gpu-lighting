# Native radial adaptive trace

Task gpu-lighting#87 / Story site#2125 and gpu-renderer#169 / Story site#2119,
Feature site#2114, 26 September 2026. Parent remote flag
`renderer.sampling.adaptivePerPixel.enabled` stays off. This is an explicitly
opt-in internal physical diagnostic, not public/site rollout. Three.js prohibited.

The real-time target applies to the adaptive configuration. Fixed32 is its
quality/work/timing control; failing fixed32 alone does not fail adaptation.

## Requested distribution

Native 1920×1080 and 3840×2160. Assign 32/16/8/4/2/1 SPP to respectively
5/10/15/20/25/25 percent of pixels, nearest the viewport centre first. Percentages
are screen **area**, not radius. Euclidean pixel-centre distance produces circular
boundaries clipped by the rectangular viewport. Resolve equal-distance ties in
row-major order to achieve exact cumulative floor(percent × pixels) counts;
only boundary pixels can break mirror symmetry. Mean is 5.95 SPP at both native
sizes: 12,337,920 / 49,351,680 primary camera samples, versus fixed32
66,355,200 / 265,420,800 (81.40625% fewer). These are predictions until read back.

Lighting owns the prescribed budget and measurement policy; this is not a new
performance governor or production importance classifier. Build the immutable
map and tile plans once per configuration, report setup cost/host bytes, reset
GPU completed counts each render. Include budget-state upload and every tile's
config packing, compaction, transport, complete-count resolve and output/present
in timed job cost. No sample/radiance reuse across frames.

Reuse renderer shared-round primitives, existing optional immediate-hit consumer,
tile-bounded queues, capped adaptive owner, canonical sample sequence (maximum
32), fixed seed/camera/scene and material transport. Select sample ranges from
the tiers present in each tile: absent upper tiers do not require empty host
rounds. Every pixel starts ordinal zero in a fresh render; ordinals never restart
at tier/range boundaries. Preserve full-screen source IDs separately from local
pixel IDs and dense queue slots, including short right/bottom tiles.

## Trace lanes and evidence

The diffuse-silhouette lane below is synthetic. Realistic Eames cost requires
the separate [original Eames source-fidelity admission](native-eames-fidelity.md)
and `native-eames-trace.html`; do not extrapolate toy-scene timings to it.

- Same lighting-owned diffuse-silhouette scene, depth ceiling four, denoise off.
  Fixed32 and radial shared/fused modes. Additional uniform32 shared/fused
  diagnostics must reproduce fixed pixels within the existing 1e-5 tolerance.
  Qualification finding: the optional fused-hit variant fails the 4K uniform
  control (maximum absolute error 0.08680737018585205), whereas ordinary shared
  transport matches bit-for-bit. Final native radial traces therefore disable
  fusion. Preserve the failed isolation run; neither relax the tolerance nor
  attribute the failure to the prescribed budget (the failed control is 32 SPP).
- Timing-only: no CPU profiler or ray/image readback commands; one warmup and
  three rotated measured frames/mode/resolution. Complete renderer job includes
  GPU presentation, not physical display or application delivery. This is a
  short engineering screen, never sustained real-time/matched-quality proof.
- Separate diagnostic frames: CPU packing/upload/encoding/finish/submit versus
  asynchronous GPU waits, per-tile GPU timestamps and actual active-queue ray
  counts/segments, every pixel's completed count, output validity and memory.
  Readback-inclusive elapsed time is separately identified, never substituted
  for timing-only means. Timestamp sums exclude upload/presentation; unsupported
  GPU timing is null, not inferred from CPU elapsed time.
- Retain native display images, radial SPP overlay, raw JSON traces, source hashes,
  failures, all requested/actual counts and per-ring linear-HDR differences from
  the fixed32 image. Fixed32 is not a converged high-SPP reference: these are
  differences, not a passed quality gate. Keep existing frozen tolerances and
  leave full reference convergence/matrix/publication gates open.
- Retain float32 bits in bounded 4 MiB raw chunks, byte-plane shuffled then gzip
  compressed with independent hashes/offsets and a full-image hash manifest.
  Reconstruct before replay; no HDR quantization or capture-limit increase.
  A bit-identical uniform image may reference the fixed manifest instead of
  duplicating its bytes. Take the native display snapshot before slow retention.
- Use fresh physical adapters/devices per resolution, bounded waits, cancellation,
  fail-closed invalid counts/overflow/device loss and deterministic cleanup.

## Tests and delivery

Before implementation: exact native histogram/mean and radial monotonicity,
pixel-centre/corner/aspect behaviour, deterministic ties/invalid inputs; complete
tile coverage and local range identity including edge tiles; unchanged fixed
transport and generic output addressing. Physical shader compilation, uniform
identity, actual radial counts and per-tile diagnostics at both native sizes are
required evidence. Run coverage/changed-source LCOV, lint/types/build/package/
Zero-Three; update README/Unreleased CHANGELOG/ADR/evidence; push and inspect CI.
No release/white-paper claim or main/CD bypass. Rollback keeps fixed GPU-native
rendering; disabling this diagnostic never enables Three.js.
