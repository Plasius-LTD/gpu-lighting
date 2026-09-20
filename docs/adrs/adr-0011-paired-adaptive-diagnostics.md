# ADR 0011: Paired adaptive prequalification diagnostics

Status: Accepted for experimental diagnostics; production qualification pending.

Task #87, Feature Plasius-LTD/plasius-ltd-site#2114, default-off parent flag
`renderer.sampling.adaptivePerPixel.enabled`. No new rollout or budget governor.

Keep experimental correctness/performance diagnosis separate from the canonical
full fixed-SPP baseline. Lighting owns the frozen protocol, reference descriptions,
HDR metrics and confidence interpretation; renderer fixtures own real execution.
Extract the existing Student-t timing implementation unchanged so browser and
baseline tooling share it. Compare paired after/before timing ratios, retain raw
rounds, and do not admit gains unless quality and reference convergence also pass.

Use corrected fixed transport on both sides to isolate adaptive scheduling. An
equal-budget lane detects plumbing regressions; deliberately preassigned reduced
budgets expose quality/performance trade-offs but cannot qualify the future
importance policy. Keep both successful and unsuccessful results, source hashes,
linear pixels, visible previews and allocation categories. No live site change,
local publishing or revival of rejected schema-1 baseline evidence. Three.js is
prohibited; rollback is fixed GPU-native rendering only.
