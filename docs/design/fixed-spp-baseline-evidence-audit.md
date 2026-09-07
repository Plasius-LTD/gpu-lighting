# Fixed-SPP baseline evidence audit

Task: https://github.com/Plasius-LTD/gpu-lighting/issues/85

## 2026-09-07 review

The original capture finished on 2026-09-01 with 216 retained lane results.
Its manifest SHA-256 is
`7619dcaa38561d441bf5b32fa1096ed5c5ea0a5aa60421931f0e4b1b9d3a55a0`.
The original files remain in the workspace's
`output/benchmarks/fixed-spp/task-85/` directory for audit.

The schema-1 runner saved adapter identity but omitted source/package versions
from each lane. Resume checked only lane configuration and trusted previously
derived statistics. Final assembly stamped the then-current package versions
onto all results, including earlier captures. Environment-heavy frame records
retain old memory telemetry, including a material-table allocation absent from
the corrected renderer. The original manifest therefore cannot establish one
consistent renderer version for every measured frame.

Disposition: historical diagnostic evidence, not a qualifying baseline. The
reported maximum CV of 26.11% and 52.22% advancement floor are provisional and
cannot admit adaptive rollout. No physical measurements have been edited or
assigned reconstructed provenance.

Schema 2 binds source revision, packages, browser, adapter, and capture date to
each lane before retention. Resume revalidates raw frame evidence and derived
statistics and rejects absent or changed identities. Full mode requires the
canonical 216 lanes, two warmups, and ten measurements. The offline verifier
rejects this original schema-1 manifest. A new qualifying capture must use a
separate output directory; Task 85 stays open until that capture and delivery
gates pass.

Three.js is permanently prohibited, including capture and fallback paths.
