# ADR 0016: Stable-pattern correction evidence

Status: accepted evidence protocol; candidate implementation remains experimental.

The shared fixed-pattern experiment failed brightness gates despite lower RMSE
and shorter jobs. Keep those images and numerical failures. Compare a stable
pixel/event-scrambled candidate, a fixed-camera/independent-lighting control,
the old fixed pattern and random baseline against the same common reference.

Require the unchanged 1% regional brightness screen plus finite global energy
within 1%. Neither static identical frames nor these means certify local noise,
silhouettes, convergence or matched-quality speed. Keep raw HDR and immutable
source/device provenance. The common 96-sample reference is not converged.

No exposure compensation, tolerance relaxation, production flag enablement or
publication claim. Renderer owns default-off renderer.sampling.stablePattern.enabled;
lighting owns metrics. Disable the flag and recreate for GPU-native rollback.
Three.js remains prohibited. See [protocol](../design/stable-pattern-correction.md).
