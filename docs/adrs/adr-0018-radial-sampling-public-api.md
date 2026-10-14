# ADR 0018: Reusable radial sample policy

Accepted for experimental implementation, 2026-10-14.

Move the existing radial budget implementation into `src/radial-sampling-plan.js`, re-export it from the normal index and a lightweight `@plasius/gpu-lighting/radial-sampling` entry. The demo re-exports the same implementation. This keeps consumers from copying diagnostic policy and avoids bundling the entire lighting package into optional inspection paths.

Six circular bands cover 5/10/15/20/25/25 percent of pixels ordered from the image centre. Sample tiers are ceil(ceiling / 2^band), clamped to one; the ceiling accepts integers 1–256 and the map accepts 20 through 3840×2160 pixels. Ties retain deterministic row-major order. The function returns typed budgets, band counts and expected mean/total samples. A ceiling of 32 gives mean 5.95 at UHD; 256 gives mean 47.6. These are prescribed allocations, not variance estimates.

No new renderer implementation, dependencies, remote state or demo appearance changes. The pure function does not evaluate product flags; calling hosts must honor `renderer.sampling.adaptivePerPixel.enabled` and relevant capabilities. Task106 / Story2120 / Feature2114. The model showcase uses an explicit localhost development override. Keep the draft dependent on the existing diagnostic branch and approved CD; disable the host adaptive path to roll back.

See [integration design](../adaptive-model-inspection.md).
