# @plasius/gpu-lighting

[![npm version](https://img.shields.io/npm/v/@plasius/gpu-lighting.svg)](https://www.npmjs.com/package/@plasius/gpu-lighting)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/gpu-lighting/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/gpu-lighting/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/gpu-lighting)](https://codecov.io/gh/Plasius-LTD/gpu-lighting)
[![License](https://img.shields.io/github/license/Plasius-LTD/gpu-lighting)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

[![license](https://img.shields.io/github/license/Plasius-LTD/gpu-lighting)](./LICENSE)

Advanced lighting WGSL modules and planning profiles for `@plasius/gpu-worker`.
The package is structured around modern lighting tracks:

- Lumen-inspired hybrid realtime GI/reflections.
- Path-traced reference lighting.
- Froxel-based volumetric lighting.
- HDRI/IBL precomputation passes.

Apache-2.0. ESM + CJS builds. WGSL assets are published in `dist/`.

## Install

```sh
npm install @plasius/gpu-lighting
```

## Browser Demo

```bash
npm run demo
```

Then open `http://localhost:8000/gpu-lighting/demo/`.

The browser demo now mounts the shared 3D harbor validation scene from
`@plasius/gpu-shared` instead of a catalog-only page, so lighting-band behavior
is visible against GLTF ships, water, and cloth.

For browser-only serving, the demo resolves `@plasius/gpu-shared` through an
import map so the page stays on the published package surface rather than a
package-private source path.

## Usage (load one technique)

```js
import {
  loadLightingTechniqueJobs,
  loadLightingTechniqueWorkerBundle,
  getLightingTechnique,
} from "@plasius/gpu-lighting";
import { assembleWorkerWgsl, loadWorkerWgsl } from "@plasius/gpu-worker";

const workerWgsl = await loadWorkerWgsl();
const { preludeWgsl, jobs } = await loadLightingTechniqueJobs("hybrid");

const shaderCode = await assembleWorkerWgsl(workerWgsl, {
  preludeWgsl,
  jobs,
});

console.log(getLightingTechnique("hybrid").description);
```

## Usage (worker governance bundle)

```js
import {
  getLightingProfileWorkerManifest,
  loadLightingTechniqueWorkerBundle,
} from "@plasius/gpu-lighting";

const bundle = await loadLightingTechniqueWorkerBundle("hybrid");

// WGSL for gpu-worker assembly
console.log(bundle.preludeWgsl, bundle.jobs);

// Contract-aligned metadata for gpu-performance and gpu-debug integrations
console.log(bundle.workerManifest.jobs[0].performance.levels);
console.log(bundle.workerManifest.jobs[0].debug);
console.log(bundle.workerManifest.schedulerMode);
console.log(bundle.workerManifest.jobs[0].worker.priority);
console.log(bundle.workerManifest.jobs[0].worker.dependencies);

const profileManifest = getLightingProfileWorkerManifest("realtime");
console.log(profileManifest.jobs.map((job) => job.worker.jobType));
```

## Distance-Banded Lighting

```js
import {
  createLightingBandPlan,
  createRayTracedShadowPostProcessPlan,
  createWaterRayTraceLightingPlan,
} from "@plasius/gpu-lighting";

const bandPlan = createLightingBandPlan({
  profile: "realtime",
  importance: "high",
});
const nearBand = bandPlan.bands.find((band) => band.band === "near");
const waterRt = createWaterRayTraceLightingPlan({
  reflections: nearBand.rtParticipation.reflections,
  directShadows: nearBand.rtParticipation.directShadows,
  quality: "ultra",
  primaryShadowSource: nearBand.primaryShadowSource,
});
const shadowPost = createRayTracedShadowPostProcessPlan({
  directShadows: nearBand.rtParticipation.directShadows,
  quality: "ultra",
  primaryShadowSource: nearBand.primaryShadowSource,
});

console.log(bandPlan.bands.map((band) => band.primaryShadowSource));
console.log(nearBand.rtParticipation, waterRt.rendererPasses, shadowPost.rendererPasses);
```

Band plans make near, mid, far, and horizon shadow sources explicit, keep RT
shadow/reflection/GI participation independent, and publish temporal reuse plus
update cadence expectations for downstream renderer and performance packages.
`createWaterRayTraceLightingPlan()` turns those participation decisions into
renderer-facing water reflection and sampled soft-shadow pass metadata.
`createRayTracedShadowPostProcessPlan()` makes the scene shadow mask and
post-processed lighting pass explicit so renderers can avoid polygon shadow
darkening when RT shadows are active.
At `quality: "ultra"`, both helpers advertise per-pixel resolve passes and zero
polygon shadow/reflection contribution for RT-owned effects.

## DAG Scheduling

Lighting worker manifests now publish `schedulerMode: "dag"` plus per-job
`priority` and `dependencies` so downstream runtimes can preserve stage order.

- `hybrid`: `directLighting` and `screenTrace` are roots; `radianceCache`,
  `finalGather`, and `reflectionResolve` unlock as upstream work finishes.
- `pathtracer`: `pathTrace -> accumulate -> denoise`
- `volumetrics`: `volumetricShadow -> froxelIntegrate`
- `hdri`: `irradianceConvolution` and `specularPrefilter` are roots; `brdfLut`
  joins after both finish.

## Usage (profile planning)

```js
import {
  createLightingProfileModeLadder,
  getLightingProfile,
  loadLightingProfile,
} from "@plasius/gpu-lighting";

const profile = getLightingProfile("realtime");
// profile.techniques -> ["hybrid", "volumetrics", "hdri"]

const plan = await loadLightingProfile("realtime");
// plan.techniques is an array of loaded prelude+job WGSL bundles.

const modeLadder = createLightingProfileModeLadder();
// modeLadder exposes reference -> hybrid -> realtime ordering for gpu-performance.
```

## Usage (reference-first performance ladder)

```js
import {
  createGpuPerformanceGovernor,
  createQualityLadderAdapter,
} from "@plasius/gpu-performance";
import {
  createLightingProfileModeLadder,
} from "@plasius/gpu-lighting";

const lightingModePlan = createLightingProfileModeLadder({
  initialProfile: "reference",
});
const lightingMode = createQualityLadderAdapter(lightingModePlan);

const governor = createGpuPerformanceGovernor({
  device,
  modules: [lightingMode],
  target: lightingModePlan.target,
  adaptation: lightingModePlan.adaptation,
});
```

`createLightingProfileModeLadder()` publishes the policy contract for the
reference-first mode you described:

- start from `reference`
- keep a 4-frame adaptation window
- hold the premium mode while the negotiated average remains at or above `30`
  FPS
- degrade the whole lighting profile to `hybrid`, then `realtime`, only when
  that window can no longer sustain the budget

The package now ships concrete WGSL contracts for:

- `pathtracer.pathTrace`: analytic scene tracing, bounce integration, and sky fallback
- `pathtracer.accumulate`: progressive history resolve with reset handling
- `pathtracer.denoise`: spatial-temporal bilateral filtering for reference previews
- `hybrid.reflectionResolve`: surface-aware reflection shading with roughness/fresnel shaping

This is still a catalog/planning package rather than proof of a finished
end-to-end renderer. Downstream runtimes such as `@plasius/gpu-renderer` still
need to bind real scene buffers and execute these kernels on the live frame
graph.

## Profiles

- `realtime`: Lumen-inspired hybrid GI/reflections + volumetrics + HDRI/IBL.
- `hybrid`: hybrid GI/reflections with HDRI/IBL support.
- `reference`: path tracing + volumetrics + HDRI/IBL for validation and lookdev.

## Techniques

- `hybrid`
  - `directLighting`
  - `screenTrace`
  - `radianceCache`
  - `finalGather`
  - `reflectionResolve`
- `pathtracer`
  - `pathTrace`
  - `accumulate`
  - `denoise`
- `volumetrics`
  - `froxelIntegrate`
  - `volumetricShadow`
- `hdri`
  - `irradianceConvolution`
  - `specularPrefilter`
  - `brdfLut`

## Demo

Run the demo server from the repo root:

```sh
cd gpu-lighting
npm run demo
```

Then open `http://localhost:8000/gpu-lighting/demo/`.
The mounted 3D scene keeps the lighting profile, band-policy, and worker-state
catalog visible while rendering the shared harbor validation surface.

## Development Checks

```sh
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run pack:check
```

## Files

- `src/index.js`: technique/profile catalogs, loader APIs, validation.
- `src/techniques/hybrid/*`: realtime hybrid GI/reflections WGSL modules.
- `src/techniques/pathtracer/*`: path tracing reference WGSL modules.
- `src/techniques/volumetrics/*`: volumetric lighting WGSL modules.
- `src/techniques/hdri/*`: HDRI/IBL precompute WGSL modules.
- `docs/adrs/*`: architecture decisions for the lighting stack.
- `docs/tdrs/*`: technical design records for worker manifests and debug hooks.
- `docs/design/*`: integration guidance for worker budgets, DAG metadata, and debug instrumentation.
