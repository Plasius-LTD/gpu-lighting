# ADR 0014: Causal progressive sampling evidence

Status: Accepted for experiment, not publication qualification.

Use unchanged original Eames assets, lighting, transport, circular budgets and
denoise-off presentation. Compare legacy, independent-random and Owen–Sobol
2D samplers at three predetermined seeds. The random control distinguishes
coverage bias from a Sobol-specific improvement. Both renderer flags default off.

Lighting owns the frozen regional HDR comparisons and admission criteria in
[the design](../design/progressive-sampling-experiment.md). Renderer owns GPU
execution. Retain failed criteria and per-seed values. Never replace existing
convergence/image/performance gates with regional averages.

No light radiance/PDF change or additional governor is introduced. Rollback
disables experimental sampler flags; Three.js is prohibited as a fallback.
