# ADR 0018: Progressive policy provenance in local captures

Status: Accepted for experimental tooling, not released consumer integration.

Feature2367 / Story2368 / lighting Task110 extends the immutable room capture
server with an optional gpu-performance policy contract. Keep gpu-performance
as the policy owner and gpu-renderer as the GPU execution/history owner. Do not
copy a second governor into lighting or a fixture. Three.js remains prohibited.

The normal room server remains unchanged without an explicit
`PLASIUS_REFINEMENT_PERFORMANCE_ROOT`. When supplied, require a clean Git checkout,
retain its commit, load its built ESM bundle/map and reject missing or stale
source-map contents against immutable committed TypeScript sources. Mount only
the explicit policy bundle/map into the existing loopback same-origin server.
Record hashes of both executed bundle bytes and source-map bytes in provenance.

The source-map check rejects stale declared sources; the hashes identify exact
executed bytes. This is not a cryptographic build attestation or a publication
path. Normal site consumers must adopt qualified released packages through
approved CD. No local publishing or production activation is authorized.

Capture one-SPP, focus, stationary, canonical and reset images separately at
native1080p/4K. Preserve original assets, linear HDR chunks, actual count evidence,
all failures and previous convergence dispositions. A small arithmetic/transport
probe is correctness evidence only. Diagnostic intervals and fewer samples are
not matched-quality performance or physical-VRAM claims. Default-off independent
controls, admission limits, cold stability and full consumer/motion qualification
remain renderer/feature gates; see renderer ADR0070 and its versioned ledger.
