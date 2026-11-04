# Guided spatial denoise: native room/Eames evidence

Status: experimental presentation improvement, not converged-quality,
matched-quality performance, real-time or production qualification.
Story [site#2249](https://github.com/Plasius-LTD/plasius-ltd-site/issues/2249),
Tasks [renderer#218](https://github.com/Plasius-LTD/gpu-renderer/issues/218) and
[lighting#101](https://github.com/Plasius-LTD/gpu-lighting/issues/101).

## Scope and reproduction

Use the README's immutable room-reference server, then select the stable sampler,
rough splitting **2 / 2 / 1**, and **Guided denoising: On**. Render at native
1920x1080 or 3840x2160. The **Show raw input** / **Show cleaned result** buttons
switch retained images from the same completed frame; they do not resample paths.
The existing splitting benchmark explicitly stays denoise-off.

Scene: original finalscene room, full Eames chair and ottoman, 269,140 triangles,
82 meshes, original textures, entry camera, placement 1.8/-1.1/-25 degrees.
Six-bounce ceiling; 32/16/8/4/2/1 circular tiers, 5.95 mean camera SPP. No scene,
material, exposure, BSDF, PDF, MIS, bounce or sample-identity changes.

The default-off `renderer.denoise.guidedSpatial.enabled` selects three
geometry/albedo-guided, linear-HDR a-trous passes followed by the unchanged tone
map. It filters eligible rough opaque non-metal surfaces only. Glossy, emissive,
transparent and background pixels are protected. This is spatial reconstruction,
not temporal reuse, variance stopping, AI image editing or a transport fix.
Three.js is prohibited and cannot be a fallback.

## Provenance

Initial paired measurements used renderer
[`2108ddbc`](https://github.com/Plasius-LTD/gpu-renderer/tree/2108ddbc8de043b1b49c01ce1c002710ebda87fd)
and lighting
[`bf5d825b`](https://github.com/Plasius-LTD/gpu-lighting/tree/bf5d825bd288ac8c0b62e5367822c64a545e785a).
The subsequent renderer `7fecfd2deb9adf5e164b868720e3e06547cbd8ff` / lighting
`fa278d21b1f16faac16e5f1c9d1a2933a0ac9795` revision strengthens flag-only invalid
and incomplete-count rejection and adds full shader-interface reflection tests.
It does not change the successful-pixel filter equations.

The final 4K recapture with those failure guards passed the expanded physical
probes and produced **identical raw HDR, filtered HDR and native PNG hashes**.
Its five-run filtered GPU median was 18.94 ms (range 17.96–21.30 ms), filtered
post-job median 19.80 ms, and raw tone-map GPU median 0.46 ms. Retain this repeat
alongside the initial table; do not select only the faster measurement.

Shared loader: `729f89c7f77fcadb9ee7eeca53fb6daf02865b8e`.
Eames manifest: site `21d43a9b63722f1ce69175a5a42b53304ee79102`.
Room SHA-256: `125331dadb83664e978a8c12cc974bae81bb7b75457e290c6063d921bbe11bc5`.
Physical adapter: Apple / metal-3, in-app browser, macOS 26.6.2. The user
identifies the machine as M2 Max; the adapter fields do not independently verify
the commercial model. Qualification does not extend to other devices/workloads.

See [retained verification](guided-denoise-2026-09-28-verification.json) for source
hashes, capture IDs, all measured timings, counters, native PNG hashes and complete
linear-image hashes. Original receipts and lossless HDR chunks are retained in
the local capture directories named there. Independent verification reconstructs
every chunk, checks finite/nonnegative RGB, alpha validity, dimensions, requested
versus completed histograms, source hashes and equality with prior raw transport.

## Measured cost

One warmup per presentation mode followed by five alternating same-input rounds.
No path rerender, CPU image processing, texture upload, readback, PNG encoding or
capture retention occurs inside the measured GPU filter interval. Job timing
adds command encoding/submission, GPU completion and presentation; query readback
is outside it. Browser timestamp quantisation is visible in the raw measurements.

| Native size | Raw tone-map GPU median | Filter + tone-map GPU median | Raw post-job median | Filtered post-job median | Added owned GPU storage |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1080p | 0.13 ms | 3.28 ms | 1.20 ms | 4.40 ms | 39.55 MiB |
| 4K | 0.52 ms | 17.43 ms | 1.80 ms | 18.80 ms | 158.20 MiB |

These are postprocessing costs, **not complete frame times**. The diagnostic
render intervals before postprocessing were about 13.53 s / 49.26 s, excluding
diagnostic readback. Do not add unlike benchmark lanes and call them a steady
60 Hz result. Even the current 4K filter alone exceeds a 16.67 ms budget.

Guide capture reuses existing first-hit records but is not free. It adds
135 / 510 dispatches, included in the tile render intervals; its incremental
GPU time was not isolated. Path segment counts remain exactly
79,102,283 / 316,403,266, with camera counts 12,337,920 / 49,351,680. Dispatch
totals before postprocessing are 21,595 / 75,078 (baseline plus one per tile).

Memory is application-visible allocation, not physical VRAM residency. Added
guides/ping-pong storage is 20 bytes/pixel plus 1 KiB uniforms, borrowing the
existing scratch texture, under a separate 192 MiB denoise admission cap.
Diagnostic staging adds 262,192 bytes and is included in the fixture staging
total, not to be counted twice. Full-resolution CPU diagnostic image arrays and
PNG/HDR encoding memory are separate, not part of the GPU denoise allocation cap.
Off allocates none of the new resources. No memory-saving claim is made.

## Correctness and visible result

- Raw HDR is bit-identical to the previous denoise-off split-depth-two captures:
  1080p `1ba5752fee3b841413a6359f38e315761171735b823a753d6614ee8eb19cd780`;
  4K `c2f32d42357b92a7f1fef4d8a7c3bf68f33930ef303cedc0b646631fc5b7e87f`.
- All requested camera counts complete; no validation errors, overflow or device
  loss in accepted native captures. Destruction succeeds.
- Synthetic physical-GPU probes preserve constant [32,24,18] radiance (no clamp
  at 16), reject invalid pixels, protect unfiltered pixels within existing
  half-float precision, and reduce the known noisy flat-patch RMSE from 0.11661
  to 0.00238. The synthetic result is not room quality or performance evidence.
- Wall grain visibly decreases, while the chair and room boundaries remain
  distinguishable. Some broad mottling and detail loss remain possible.
- Filtered mean linear RGB changes approximately -0.320% / -0.332% versus raw
  half-float input. Spatial filtering is biased; no exposure correction was used
  to hide this. Raw transport energy remains unchanged.
- Unit/integration checks include default-off command equivalence, allocation
  admission, partial setup cleanup, source-pixel ownership, capture ordering,
  actual counts and assembled ABI reflection. Browser checks cover comparison
  reversal, stale-output clearing, locked controls, reset and rejected/cancelled
  captures. Desktop and 1024-pixel-wide layouts were inspected; controls wrap
  without horizontal overflow and the native-aspect image remains accessible by
  normal page scrolling. No cancelled capture is promoted to accepted evidence.

### Native images

1080p: [raw reference](rough-split-1080p-depth2-2026-09-28.png) and
[guided result](guided-denoise-1080p-2026-09-28.png).

4K: [raw reference](rough-split-4k-depth2-2026-09-28.png) and
[guided result](guided-denoise-4k-2026-09-28.png).

The raw HDR and raw native PNG hashes agree with the earlier split-depth-two
images. These are actual renderer outputs, not upscales or retouched images.

## Remaining qualification

No converged room reference or texture-detail/temporal matched-quality study has
passed. This cannot close the broader adaptive Feature, justify white-paper
speedups, or conceal the already tracked transport defects. Optimize filter
bandwidth/weighting and evaluate detail retention without relaxing existing
quality tolerances. No production flag, package publication or main/CD change.

Design background: [Dammertz et al., HPG 2010](https://diglib.eg.org/handle/10.2312/EGGH.HPG10.067-075).
This is a bounded adaptation of spatial edge-aware filtering, not a claimed
reproduction of that paper's quality or performance.
