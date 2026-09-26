# Native-resolution real-time acceptance

User requirement, 26 September 2026. Feature site#2114; benchmark Story site#2125,
gpu-lighting#87; renderer integration Story site#2119, gpu-renderer#169.
The parent remote `renderer.sampling.adaptivePerPixel.enabled` remains default off.
Three.js is prohibited and cannot be a fallback.

## Product gate

- Minimum: native **1920×1080 at sustained 60 Hz on the user's M2 Max MacBook Pro**.
  Failure to meet this means the real-time milestone has not succeeded.
- Ideal target: native **3840×2160 at 60 Hz**, measured separately. 1440p remains
  an intermediate diagnostic, not a replacement for either target.
- Budget: 1000/60 = 16.6667 ms per complete frame. No silent render-scale reduction,
  upscaling, repeated/stale frames, interpolation, reference-quality relaxation,
  unreported SPP reduction or fabricated GPU/actual-count evidence.
- 128×128 probes remain useful for shader/identity/ABI/failure diagnostics only.
  They cannot qualify real-time performance, including by extrapolation.

Use the existing required scene/bounce/SPP matrix and frozen linear-HDR quality
criteria. Begin with the fixed32, four-bounce reference, then compare independently
enabled and combined adaptive mechanisms at matched quality. Record requested,
effective and GPU-completed SPP separately, camera/environment/denoise/flags,
actual rays/segments, allocation classes and all failures. Adaptive methods may
reduce work only while satisfying the existing quality gate.

Qualification needs full application timing including preparation, classification,
encoding, uploads, GPU transport, resolve, denoise if enabled, presentation work
and other application work. Record GPU timing separately, never substitute a
compute-only timestamp or render promise for physical display delivery. Retain
mean/p50/p95/p99/max, every missed 16.6667 ms deadline, fresh-frame delivery and
frame pacing over a sustained foreground run, with power/thermal/display/browser
conditions and device/source provenance. An average below budget alone is not
a pass. Existing matched-quality confidence gates also remain mandatory.

## Immediate full-frame screen, not qualification

The adaptive paired runner is explicitly single-tile (128×128). Its hardcoded
output addressing, single-tile telemetry and readback must not be resized or
multiplied into a full-frame performance claim. A full tiled adaptive integration
and representative scene/presentation qualification remain required work.

First run the canonical fixed renderer at actual native 1080p and 4K. Reuse its
tile-bounded queues, existing completion waits and presentation stage, with 32
SPP, four bounces, denoise off, zero frame-budget reduction, no motion/per-pixel
adaptation. Reuse the lighting-owned diffuse-silhouette scene as a simple lower
complexity screen, clearly not the Eames/product scene. One warmup and three
measured full frames can reveal an obvious shortfall; they cannot prove sustained
60 Hz or matched quality. If the renderer alone exceeds the budget, adding the
application cannot turn that measurement into a pass.

The lighting-owned screen summary rejects all non-native presets (including
128×128 and upscaled output), non-finite/zero/negative or insufficient timings.
Reuse existing timing statistics; report deadline misses and tails. Return
`qualifies60Hz: false` even for fast samples: missing sustained application,
display and image evidence is never success. Missing actual sample/ray/overflow
readback is explicitly unmeasured, not zero or inferred GPU evidence.

The renderer-owned page records native canvas/config sizes, source hashes, the
snapshot/memory estimate, warmup and raw per-frame job timings, browser visibility,
and a display PNG. Probe/statistics readback is disabled in the timed lane. PNG is
illustrative, not linear-HDR qualification. Retain failures/cancellations, drain
before cleanup, enforce existing bounded GPU waits. Do not change shaders,
transport, quality, frame scheduling or allocations merely to improve this screen.

Requirements-first tests: preset enforcement, exact 60 Hz boundary, percentile
and deadline arithmetic, invalid/missing timings, immutable inputs, fast samples
never qualifying. Validate the physical 1080p and 4K full-frame paths and retain
all results. Update README/Unreleased CHANGELOG, tests/coverage, lint/syntax,
package/Zero-Three and post-push CI. Site activation/main/CD remain separate.

Rollback is the unchanged fixed GPU-native renderer; the resolution/quality
acceptance gate is unconditional, not bypassable by a feature flag.
