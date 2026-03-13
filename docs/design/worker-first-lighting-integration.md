# Worker-First Lighting Integration

## Goals

- Keep lighting jobs aligned to `gpu-worker`.
- Provide ready-to-consume budget ladders for `gpu-performance`.
- Provide opt-in debug descriptors for `gpu-debug`.

## Manifest Shape

Each lighting technique publishes a manifest with:

- owner: `lighting`
- queue class: `lighting`
- scheduler mode: `dag`
- suggested allocation ids for key GPU resources
- per-job worker, performance, and debug contracts

Each job may also publish:

- `priority` for ready-queue ordering
- `dependencies` for ordered lighting stages and join points

## Consumer Usage

1. Load a lighting worker bundle for the chosen technique.
2. Register WGSL jobs with `gpu-worker`.
3. Convert `performance` entries into worker-budget adapters in
   `gpu-performance`.
4. When debug is enabled, map `debug` entries into local `gpu-debug` samples.

## Initial Budget Guidance

- Hybrid GI/reflections prioritize `finalGather`, `screenTrace`, and
  `radianceCache`.
- Path tracing uses smaller batch sizes and stronger cadence reduction at lower
  levels.
- Volumetrics and HDRI jobs expose lighter-weight ladders appropriate to their
  cost profile.

## DAG Guidance

- Treat technique roots as the first runnable jobs in the queue.
- Publish downstream dependencies using the full manifest job labels so
  `@plasius/gpu-performance` and `@plasius/gpu-worker` see the same identifiers.
- Keep priority values bounded and package-owned; consumers should not need to
  reinterpret the lighting graph.
