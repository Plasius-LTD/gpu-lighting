# ADR 0013: Prescribed native radial budget diagnostic

Status: accepted for internal diagnostics. Date: 2026-09-26.
Task #87 / Story site#2125 / Feature site#2114.

Lighting owns a deterministic prescribed budget map, not a second performance
governor. Assign pixels by circular Euclidean pixel-centre distance, clipped to
the viewport; use deterministic row-major boundary ties for exact requested area
shares. The user's 5/10/15/20/25/25% at 32/16/8/4/2/1 SPP averages 5.95 SPP.
Preparation can be cached and separately measured; renderer resets all counts
and includes upload and complete-frame work in timing. No temporal sample reuse.

Fixed32 is the control, not a required real-time configuration. Renderer owns
multi-tile integration/transport; this package owns distribution, protocol and
image/timing statistics. Report instrumented traces separately from timing-only
frames, and fixed-image differences separately from converged-reference quality.
Existing frozen acceptance/quality/release gates remain in force. No site/public
rollout; parent renderer.sampling.adaptivePerPixel.enabled remains default off.
Three.js is prohibited, including fallback/rollback.

The consequence is reproducible engineering evidence for a prescribed workload,
not qualification of production geometry/material/environment protection policy.
