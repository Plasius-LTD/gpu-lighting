# ADR 0017: Local room assets have separate provenance and publication permission

Status: Accepted for experimental reference tooling, 2026-09-28.

The renderer reference needs user-supplied rooms without implicitly publishing
them. Lighting accepts one explicit CLI GLB, validates a bounded self-contained
static scene and snapshots its bytes in memory. Code remains commit-pinned;
the external asset receives independent hash/count evidence and a local-only
publication designation. Serve exact mapped URLs on 127.0.0.1 with same-origin
and Host admission, no arbitrary filesystem endpoint. GPU-shared remains the
only model/material/texture loader; GPU-renderer owns all transport and filtering.

Reuse existing compatible room coordinates, camera and Eames controls; no new
public renderer API, proxy geometry, material override or scene simplification.
Do not equate a different scene's time with a renderer speedup. Raw/filtered
images remain local unless separately approved. Existing production flags remain
off. No Three.js fallback is permitted. Return to the default server invocation
for the original room; private asset retirement needs no package release.

Tracking: site#2114 / site#2249, lighting#102, renderer#219.
