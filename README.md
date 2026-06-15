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

## Screenshot Capture

The repo also carries the Eames-chair environment validation harness under
`demo/eames-environments/` plus tracked Playwright helpers under
`scripts/eames-environments/`. The referenced chair asset is tracked under
`data/models/eames-lounge-chair-ottoman/` so fresh repo checkouts can run the
validation page without depending on a parent monorepo checkout. Build
`gpu-performance`, `gpu-renderer`, and `gpu-lighting` first, then run:

```bash
node scripts/eames-environments/capture.mjs
```

For reverse-pass black-pixel diagnostics, run:

```bash
node scripts/eames-environments/path-debug-capture.mjs
```

If fresh Playwright Chromium bootstrap is unstable on macOS, start a
WebGPU-capable Chrome separately with remote debugging enabled and set
`PLASIUS_CAPTURE_CDP_URL=http://127.0.0.1:<port>` before running the capture
script. The validation page now reports bootstrap step, detail, and WebGPU
availability through `window.__plasiusCaptureState` and
`window.__plasiusCaptureError` so capture failures stop at a named phase rather
than hanging on the initial HUD.

For browser-controlled fallbacks, start
`node scripts/eames-environments/capture-bridge-server.mjs <port>` and open the
validation page with `captureBitmap=1` plus
`captureUploadPath=output/playwright/eames-environments/<name>.png`. If the page
is being served by a plain static server such as `python -m http.server`, also
pass
`captureUploadUrl=http://127.0.0.1:<port>/__plasius-capture`. The page will
freeze its own canvas and POST the PNG back to the bridge server once the
render completes. The browser-side upload helper now rejects non-loopback
capture endpoints so this fallback cannot be redirected at arbitrary remote
origins.

The main capture and reverse-pass debug capture entry points now share the same
server-selection helper, so local reuse, fresh static-server startup, and
bridge fallback all follow the same port and readiness rules across macOS and
Linux.

The capture scripts now pin deterministic validation settings unless explicitly
overridden:

- `PLASIUS_CAPTURE_MAX_DEPTH=8`
- `PLASIUS_CAPTURE_SPP=1`
- `PLASIUS_CAPTURE_FRAMES=1`
- `PLASIUS_CAPTURE_DENOISE=1`
- `PLASIUS_CAPTURE_MOTION=0`
- `PLASIUS_CAPTURE_FRAME_INDEX=777`
- `PLASIUS_CAPTURE_PROBE=1`

They save canvas-only PNGs plus per-capture JSON under
`output/playwright/eames-environments/`, including exact-black, near-black, and
average-luminance metrics so screenshot comparisons stay apples-to-apples. The
validation page now decouples optional probe readback from the heavy render
submission itself, which keeps higher-SPP screenshot validation more stable.
For motion or realtime validation, the page also accepts `frameTimeBudgetMs`
and will render at least one full-screen sample before adaptively spending the
rest of the per-frame budget on additional SPP passes. The HUD reports
`rendered/target spp` whenever the budgeted frame lands below the configured
ceiling. When `gpu-performance/dist/index.js` is available, the Eames harness
also routes that target through a `@plasius/gpu-performance` quality ladder fed
by `gpu-renderer`'s wavefront adaptive-sampling levels, so the requested SPP
becomes a release-grade ceiling rather than an ungoverned demo-local heuristic.
The Eames loader also preserves authored UVs, decoded base-colour,
metallic-roughness, normal, occlusion, and emissive maps, plus authored glTF
material factors such as clearcoat, sheen colour, specular colour,
transmission, and IOR when present. That keeps the validation scene on the
shared renderer path instead of relying on material-name-specific overrides for
leather, wood, and chrome.

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
import { createLightingBandPlan } from "@plasius/gpu-lighting";

const bandPlan = createLightingBandPlan({
  profile: "realtime",
  importance: "high",
});

console.log(bandPlan.bands.map((band) => band.primaryShadowSource));
console.log(bandPlan.bands.find((band) => band.band === "near").rtParticipation);
```

Band plans make near, mid, far, and horizon shadow sources explicit, keep RT
shadow/reflection/GI participation independent, and publish temporal reuse plus
update cadence expectations for downstream renderer and performance packages.

## Environment Lighting Presets

```js
import {
  createEnvironmentLightingConfig,
  createWavefrontEnvironmentLightingOptions,
} from "@plasius/gpu-lighting";

const lighting = createEnvironmentLightingConfig({
  scene: "forest",
  timeOfDay: "dusk",
  intensity: 1.05,
  environmentPortals: [
    {
      id: "north-window",
      position: [0, 1.2, -2.4],
      normal: [0, 0, 1],
      tangent: [1, 0, 0],
      width: 1.8,
      height: 1.1,
      intensity: 1.4,
    },
  ],
});

const wavefrontLighting = createWavefrontEnvironmentLightingOptions({
  preset: "cavern-night",
});

console.log(lighting.environmentLightSources.map((source) => source.kind));
console.log(wavefrontLighting.environmentMissLighting.startingPoint);
```

`createEnvironmentLightingConfig(...)` owns the reusable sky/environment
semantics: horizon and zenith colours, key-light direction, key-light colour,
environment intensity, exposure, ambient residual colour, and optional
environment-light portals. The grass-field, forest, warehouse, and cavern
families use restrained ambient residual scaling so low-sample renderers keep
some final-bounce colour without washing dark materials toward white. They also
publish `sunlitBaseline`, a scene-scaled time-of-day daylight floor that
renderers can use at terminal path collisions without raising the global
ambient colour.

Preset families now cover:

- `grass-field-{dawn,midday,dusk,night}`
- `forest-{dawn,midday,dusk,night}`
- `warehouse-{dawn,midday,dusk,night}`
- `cavern-{dawn,midday,dusk,night}`

Callers can pass the combined `preset` name directly or pass `scene` plus
`timeOfDay`; scene-only aliases default to `midday`.

Each preset publishes `scene`, `timeOfDay`, normalized
`sunlitBaseline`, `environmentLightSources`, a `dominantLightSource`, and
`environmentMissLighting`. Source metadata includes source kind, role, direction,
position, colour, intensity, radiance, luminance, reach, and angular radius.
Renderers can use `environmentMissLighting` when a path ray misses scene
geometry: the miss has an inferred source colour/brightness and a stable
`startingPoint` of `environment-miss` instead of an unbounded null/negative sky
sample. Emissive material hits remain explicit light-source hits and should not
be double-counted by environment inference. Callers can also pass an
`environmentMap`/`hdri` descriptor; the lighting config preserves it in
`createWavefrontEnvironmentLightingOptions(...)` so the wavefront renderer can
sample an equirectangular radiance map for environment misses and ambient
residuals instead of relying primarily on static ambient values.

Portals describe physical openings such as windows where outside radiance can
enter an interior. They are normalized as rectangle apertures with position,
normal, tangent, dimensions, colour, and radiance scale.
`createWavefrontEnvironmentLightingOptions(...)` projects that contract into the
current `@plasius/gpu-renderer` wavefront renderer options without making the
renderer depend on this package directly.

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

- `hybrid.directLighting`: direct sun/sky resolve with roughness-aware specular shaping
- `hybrid.screenTrace`: first-hit reflection tracing over the shared hybrid scene contracts
- `hybrid.radianceCache`: irradiance history updates for cache-backed indirect reuse
- `hybrid.finalGather`: cache + trace composition with temporal reuse for the hybrid GI path
- `volumetrics.volumetricShadow`: slice-aware Beer-Lambert shadow history for fog and shafts
- `volumetrics.froxelIntegrate`: froxel scattering/extinction integration with temporal stability
- `hdri.irradianceConvolution`: cosine-weighted diffuse environment convolution
- `hdri.specularPrefilter`: roughness-aware environment prefiltering for glossy IBL
- `hdri.brdfLut`: split-sum BRDF LUT integration for image-based lighting
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
  - `froxelIntegrate`: accumulates participating-media scattering/extinction per froxel
  - `volumetricShadow`: resolves directional shadow transmittance history per froxel
- `hdri`
  - `irradianceConvolution`: builds diffuse irradiance from the environment source
  - `specularPrefilter`: builds roughness-aware glossy environment mip data
  - `brdfLut`: integrates the split-sum BRDF lookup surface for IBL

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
