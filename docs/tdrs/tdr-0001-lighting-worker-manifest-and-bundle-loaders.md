# Technical Design Record (TDR)

## Title

TDR-0001: Lighting Worker Manifest and Bundle Loaders

## Status

- Proposed -> Accepted
- Date: 2026-03-13
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Scope

Defines the worker-governance surface published by `@plasius/gpu-lighting`.

## Context

The package already provides technique catalogs and WGSL loaders. Consumers now
also need a stable way to discover:

- worker job labels,
- suggested performance budget ladders,
- debug ownership and resource tags,
- DAG scheduling metadata for ordered technique stages,
- profile-level aggregation across techniques.

## Design

The package publishes:

- `lightingWorkerManifests`
- `getLightingTechniqueWorkerManifest(name)`
- `getLightingProfileWorkerManifest(name)`
- `loadLightingTechniqueWorkerBundle(name, options)`
- `loadLightingProfileWorkerPlan(name, options)`

Worker manifests stay data-only so the package does not depend directly on the
runtime APIs of `gpu-performance` or `gpu-debug`.

## Data Contracts

Each manifest job contains:

- `worker.jobType`
- `worker.queueClass`
- `worker.priority`
- `worker.dependencies[]`
- `worker.schedulerMode`
- `performance.id`
- `performance.domain`
- `performance.authority`
- `performance.importance`
- `performance.levels[]`
- `debug.owner`
- `debug.tags[]`
- `debug.suggestedAllocationIds[]`

## Operational Considerations

- Reliability: unknown profile and technique names fail fast.
- Observability: debug tags and allocation ids create stable integration hooks.
- Coordination: lighting packages publish DAG ordering as data so downstream
  packages do not reconstruct stage graphs.
- Security: manifests are static local data with no network behavior.
- Cost: bundle loaders reuse existing WGSL loader flows.

## Rollout and Migration

1. Keep existing WGSL loader APIs intact.
2. Add worker-manifest consumption in early adopter packages or apps.
3. Tune budget presets as real profiling data becomes available.

## Risks and Mitigations

- Risk: budget presets may not match all scenes.
  Mitigation: publish them as suggested defaults, not mandatory runtime policy.
- Risk: downstream consumers may overfit to current allocation ids.
  Mitigation: keep ids stable and document them as package-owned hints.

## Open Questions

- Whether future lighting techniques need queue classes beyond `lighting`.
