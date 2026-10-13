# High-SPP diagnostic radial reference

Parent site Epic #2113 / Feature #2114 / Story #2256; renderer companion design:
`gpu-renderer/docs/design/high-spp-room-reference.md`. Local screenshot test,
not production policy or a new governor. Three.js prohibited, including fallback.

Reuse `createRadialSamplingPlan` with a variable integer diagnostic ceiling
from 1 to the renderer packed-ABI limit 256, default 32. Derive each tier as
max(1, ceil(ceiling / 2^bandIndex)); no hard-coded preset whitelist. Fractional
budgets round upwards; duplicate low-ceiling tiers combine in count admission.
Preserve all circular area shares/boundaries: 5/10/15/20/25/25 percent.
For 256 use tiers 256/128/64/32/16/8 and Uint16 storage, avoiding Uint8 wrap to
zero. Every budget is exactly eight times its former value. Native 4K mean is
47.6 SPP and total camera samples 394,813,440. Preserve room materials, camera,
placement and existing default 32 preset. Extend `roomReferenceSettings` and
count admission coherently; renderer owns execution, buffers and screenshot UI.

Tests first: native 1080p/4K exact histograms/totals, unchanged circular boundaries
and deterministic tie ordering, unchanged default budget type/values, bounded
ceiling validation and partial/mislabeled frame rejection. Run full unit tests,
coverage/LCOV for changed code, lint/types, package/zero-Three gates and post-push
CI. Add README and Unreleased CHANGELOG. No architectural change or new public
lighting contract; existing reference-scene design applies.

Physical evidence comes from renderer's 4K six-bounce stable/split-two room lane.
Retain source hashes, actual SPP, native raw/cleaned PNG and linear HDR. No claims
of material conformance, convergence or real-time speed. Protect private source
models. More samples cost time; wider budgets add host bytes and config storage,
not smaller VRAM. Existing flags remain default-off; this is an explicit local
override under `renderer.sampling.adaptivePerPixel.enabled`, with independent
`renderer.denoise.guidedSpatial.enabled` and `gpu-demo.scene-fidelity.enabled`.
Rollback to the 32 preset; no local publishing, main/CD bypass or legacy renderer.
