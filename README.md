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

## Usage (load one technique)

```js
import {
  loadLightingTechniqueJobs,
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

## Usage (profile planning)

```js
import {
  getLightingProfile,
  loadLightingProfile,
} from "@plasius/gpu-lighting";

const profile = getLightingProfile("realtime");
// profile.techniques -> ["hybrid", "volumetrics", "hdri"]

const plan = await loadLightingProfile("realtime");
// plan.techniques is an array of loaded prelude+job WGSL bundles.
```

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
