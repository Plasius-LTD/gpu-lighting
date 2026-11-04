# Room + Eames reference: captured, not quality-qualified

Tracking: [renderer Task 169](https://github.com/Plasius-LTD/gpu-renderer/issues/169),
[lighting Task 87](https://github.com/Plasius-LTD/gpu-lighting/issues/87),
[Feature 2114](https://github.com/Plasius-LTD/plasius-ltd-site/issues/2114).

The user explicitly approved committing the supplied `finalscene.glb` and demo
to the public repositories. Its original bytes are preserved. The scene contains
all 3,672 room triangles and all 265,468 original Eames triangles: 269,140 total,
82 meshes, no proxy or old studio floor/walls/emitter panel. Room lighting is
supplied externally; the GLB has no authored lights.

## Immutable inputs

- Room SHA-256: `125331dadb83664e978a8c12cc974bae81bb7b75457e290c6063d921bbe11bc5`.
- Lighting: `b0884f758076e0401165d9ea6eb792065c0afe32`.
- Shared loader/composer: `729f89c7f77fcadb9ee7eeca53fb6daf02865b8e`.
- Original Eames site assets: `21d43a9b63722f1ce69175a5a42b53304ee79102`.
- Renderer for initial 1080p captures: `00e16914cdbe239afc4860aa7804189727dca053`.
- Renderer for 4K/corner captures: `ffb7d6d0266775937ad7cb7a07f2d901022fc283`.
  The latter changes preview invalidation during input, not transport.

The loopback server served immutable Git objects from clean checkouts. Each
capture has its own source-bound identifier; no private source directory is
required after committing the GLB. The original Eames manifest still admits its
original model/material/texture inputs.

## Physical checks

Browser interaction used the normal reference controls on a non-fallback Apple
`metal-3` adapter. Six bounces, maximum 32 SPP, circular 32/16/8/4/2/1 tiers,
5.95 mean SPP, denoise off, seed 7. Captures are diagnostic runs with readbacks,
not performance benchmarks.

| Capture | Native size | View / placement | Completed camera samples |
| --- | --- | --- | ---: |
| Fast fixed pattern | 1920 × 1080 | Entry; 1.8, -1.1, -25° | 12,337,920 |
| Stable comparison | 1920 × 1080 | Entry; 1.8, -1.1, -25° | 12,337,920 |
| Stable placement check | 1920 × 1080 | Front; 2, -1, -10° | 12,337,920 |
| Fast alternate view | 1920 × 1080 | Corner; 1.8, -1.1, -25° | 12,337,920 |
| Fast 4K | 3840 × 2160 | Entry; 1.8, -1.1, -25° | 49,351,680 |

All five receipts passed independent PNG dimension, total sample, tier histogram,
269,140-triangle admission, zero WebGPU validation-error, successful cleanup,
lossless HDR chunk/hash and finite-float checks. HDR is 33,177,600 bytes/eight
chunks at 1080p and 132,710,400 bytes/32 chunks at 4K. Complete raw receipts and
HDR chunks are retained locally under `output/playwright/eames-environments/`
with the capture IDs below; they are not included in this public screenshot
summary. Consequently this document is not a complete reproducibility archive.

Public native images:

- [4K fast image](room-eames-4k-fixed-2026-09-28.png): PNG SHA-256
  `6e39fa22c6ead19db5e76cb4812c6f0018ace7e6baf677b8cac0dcf599971e70`;
  HDR SHA-256 `3ce9ba589f40be207d3e6477cf709d9f8f9b341d5f1f405f3cc8ba4d338bfe7b`;
  capture `room-reference-2026-09-28T09-29-12-446Z-4556d04c-156b-4610-8613-48e4c5323965`.
- [1080p stable image](room-eames-1080p-stable-2026-09-28.png): PNG SHA-256
  `d6181a3c6e570bf6e73282dfdd4018d6fab23fee297b4c78b47df08fe6f558ac`;
  HDR SHA-256 `ce2ae901abbc48804f7bc1cf5ff2090c56661224f7c0c48748b26b73817d9f5d`;
  capture `room-reference-2026-09-28T09-25-40-783Z-946569d0-0d68-4209-b273-da98c17a5e2f`.

## UI and local validation

Verified resolution/sampler selection, all three camera presets, translation and
rotation between renders, reset, invalid numeric placement rejection, locked
controls during work, preview invalidation on input and restored controls after
successful capture. A regression test failed before adding immediate input
invalidation and passed afterward. Cancellation was attempted, but browser
control timed out and the frame finished before delivery: cancellation is **not
physically verified here**. Responsive/device-loss/timeout testing and the broader
benchmark matrix are also not claimed.

Renderer: 326 tests, 96.07% line coverage. Lighting: 156 tests, 80.69% line
coverage. Both passed lint, types, build, package, zero-Three and runtime audit
checks; renderer lint and full coverage were repeated after the preview fix.
No shader/runtime transport or production flags were changed. The binary's
historical exporter label does not install or execute a prohibited dependency.

## Observations and limits

The Eames chair and ottoman are visible inside the supplied room and respond to
placement/view changes. The fast sampler produces conspicuous coherent triangular
lighting artifacts across walls and floor at both native resolutions. The stable
comparison removes much of that coherent pattern but remains visibly grainy.
This is useful defect evidence, **not** proof of a correct or promotion-ready
image. Changing the sampler alone changes the appearance, consistent with the
previously tracked correlation concern; it does not establish the complete cause.

No new convergence, matched-quality speedup, real-time, physical-lighting or
memory-improvement claim is supported. Single diagnostic runs include readback
cost and cannot substitute for timing qualification. Wall collision avoidance is
not implemented; placement admission checks only the containing room bounds.
The existing Tasks/Feature remain open. Merge, renderer CI, full qualification
and applicable main/CD release gates remain separate obligations; no package or
production deployment was performed.
