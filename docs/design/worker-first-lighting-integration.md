# Worker-First Lighting Integration

## Goals

- Keep lighting jobs aligned to `gpu-worker`.
- Provide ready-to-consume budget ladders for `gpu-performance`.
- Provide opt-in debug descriptors for `gpu-debug`.

## Manifest Shape

Each lighting technique publishes a manifest with:

- owner: `lighting`
- queue class: `lighting`
- suggested allocation ids for key GPU resources
- per-job worker, performance, and debug contracts

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
