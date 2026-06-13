import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const originalImportMetaUrl = globalThis.__IMPORT_META_URL__;
globalThis.__IMPORT_META_URL__ = new URL("../src/index.js", import.meta.url);
const {
  createLightingProfileModeLadder,
  createEnvironmentLightingConfig,
  createWavefrontEnvironmentLightingOptions,
  defaultAdaptiveLightingProfilePolicy,
  defaultLightingProfile,
  defaultLightingTechnique,
  getLightingProfile,
  getLightingProfileWorkerManifest,
  getLightingTechnique,
  getLightingTechniqueWorkerManifest,
  lightingProfileModeOrder,
  lightingProfileNames,
  lightingProfiles,
  lightingEnvironmentLightSourceKinds,
  lightingEnvironmentPortalModes,
  lightingEnvironmentPortalShapes,
  lightingPreludeWgslUrl,
  lightingEnvironmentPresetNames,
  lightingEnvironmentSceneNames,
  lightingEnvironmentTimeOfDayNames,
  lightingTechniqueNames,
  lightingTechniques,
  loadLightingJobs,
  loadLightingPreludeWgsl,
  loadLightingProfile,
  loadLightingProfileWorkerPlan,
  loadLightingTechniqueJobWgsl,
  loadLightingTechniqueJobs,
  loadLightingTechniquePreludeWgsl,
  loadLightingTechniqueWorkerBundle,
} = await import("../src/index.js");
if (typeof originalImportMetaUrl === "undefined") {
  delete globalThis.__IMPORT_META_URL__;
} else {
  globalThis.__IMPORT_META_URL__ = originalImportMetaUrl;
}

const previousEamesModuleOnly = globalThis.__PLASIUS_EAMES_ENVIRONMENT_MODULE_ONLY__;
globalThis.__PLASIUS_EAMES_ENVIRONMENT_MODULE_ONLY__ = true;
const {
  buildEamesMeshes,
  buildEnvironmentSceneObjects,
  computeCaptureBootTimeoutMs,
  createAdaptiveSamplingController,
  createEnvironmentCamera,
  createCaptureState,
  listCaptureUploadUrlCandidates,
  normalizeCaptureError,
  readWebGpuBootstrapSnapshot,
  renderEamesEnvironment,
  resolveCaptureUploadUrl,
} = await import("../demo/eames-environments/page.js");
const {
  decodePngDataUrl,
  ensureCaptureArtifactDirectory,
  formatCaptureDiagnostic,
  looksLikeBrowserBootstrapFailure,
  readOptionalString,
  resolveCaptureBrowserProfileDirectory,
  resolveCaptureArtifactDirectory,
  resolveCaptureWorkspaceRoot,
  summarizeRgbaPixels,
} = await import("../scripts/eames-environments/capture-runtime.mjs");
const {
  buildCaptureAssetUrl,
  findCaptureServerPort,
} = await import("../scripts/eames-environments/capture-server.mjs");
const { loadEamesGltfModel } = await import("../demo/eames-environments/eames-loader.js");
if (typeof previousEamesModuleOnly === "undefined") {
  delete globalThis.__PLASIUS_EAMES_ENVIRONMENT_MODULE_ONLY__;
} else {
  globalThis.__PLASIUS_EAMES_ENVIRONMENT_MODULE_ONLY__ = previousEamesModuleOnly;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function urlToPath(url) {
  return fileURLToPath(url);
}

function roundColor(value) {
  return value.map((component) => Number(component.toFixed(4)));
}

function luminance(value) {
  return value[0] * 0.2126 + value[1] * 0.7152 + value[2] * 0.0722;
}

async function importLightingModuleWithBase(metaUrl, querySuffix) {
  const previous = globalThis.__IMPORT_META_URL__;
  globalThis.__IMPORT_META_URL__ = metaUrl;
  try {
    return await import(`../src/index.js?${querySuffix}`);
  } finally {
    if (typeof previous === "undefined") {
      delete globalThis.__IMPORT_META_URL__;
    } else {
      globalThis.__IMPORT_META_URL__ = previous;
    }
  }
}

test("lighting techniques expose WGSL files", () => {
  assert.ok(lightingTechniqueNames.length > 0);
  for (const techniqueName of lightingTechniqueNames) {
    const technique = lightingTechniques[techniqueName];
    assert.ok(technique, `Missing technique: ${techniqueName}`);
    assert.ok(fs.existsSync(urlToPath(technique.preludeUrl)));
    for (const job of technique.jobs) {
      assert.ok(fs.existsSync(urlToPath(job.url)));
    }
  }
});

test("default lighting technique prelude URL points at hybrid prelude", () => {
  assert.equal(defaultLightingTechnique, "hybrid");
  assert.ok(lightingPreludeWgslUrl instanceof URL);
  assert.ok(
    lightingPreludeWgslUrl.pathname.endsWith(
      `/techniques/${defaultLightingTechnique}/prelude.wgsl`
    )
  );
});

test("environment lighting config exposes named presets for renderers", () => {
  const config = createEnvironmentLightingConfig({
    preset: "product-studio",
    intensity: 1.2,
  });

  assert.ok(lightingEnvironmentPresetNames.includes("product-studio"));
  assert.ok(lightingEnvironmentPresetNames.includes("grass-field-midday"));
  assert.ok(lightingEnvironmentPresetNames.includes("forest-dusk"));
  assert.ok(lightingEnvironmentPresetNames.includes("warehouse-night"));
  assert.ok(lightingEnvironmentPresetNames.includes("cavern-dawn"));
  assert.equal(config.preset, "product-studio");
  assert.equal(config.environmentIntensity, 1.2);
  assert.equal(config.wavefront.environmentLighting.intensity, 1.2);
  assert.equal(config.wavefront.environmentColor.length, 4);
  assert.equal(config.wavefront.ambientColor.length, 4);
  assert.equal(config.wavefront.environmentPortalMode, "disabled");
  assert.deepEqual(config.wavefront.environmentPortals, []);
  assert.ok(config.wavefront.environmentLighting.sunDirection.every(Number.isFinite));
});

test("environment presets cover outdoor, interior, and underground time-of-day variants", () => {
  assert.deepEqual(lightingEnvironmentTimeOfDayNames, [
    "dawn",
    "midday",
    "dusk",
    "night",
  ]);
  assert.deepEqual(lightingEnvironmentSceneNames, [
    "studio",
    "harbor",
    "grass-field",
    "forest",
    "warehouse",
    "cavern",
  ]);
  assert.ok(lightingEnvironmentLightSourceKinds.includes("sun"));
  assert.ok(lightingEnvironmentLightSourceKinds.includes("fluorescent-strip"));
  assert.ok(lightingEnvironmentLightSourceKinds.includes("torch"));

  const requiredScenes = ["grass-field", "forest", "warehouse", "cavern"];
  for (const scene of requiredScenes) {
    for (const timeOfDay of lightingEnvironmentTimeOfDayNames) {
      const presetName = `${scene}-${timeOfDay}`;
      assert.ok(
        lightingEnvironmentPresetNames.includes(presetName),
        `Missing environment preset: ${presetName}`
      );
      const config = createEnvironmentLightingConfig({ preset: presetName });
      assert.equal(config.scene, scene);
      assert.equal(config.timeOfDay, timeOfDay);
      assert.ok(config.environmentLightSources.length >= 2);
      assert.ok(config.dominantLightSource);
      assert.equal(config.environmentMissLighting.sourceId, config.dominantLightSource.id);
      assert.ok(config.environmentMissLighting.luminance > 0);
      assert.ok(config.environmentColor.slice(0, 3).every((component) => component > 0));
      assert.ok(config.sunlitBaseline > 0);
      assert.equal(config.wavefront.sunlitBaseline, config.sunlitBaseline);
      assert.equal(
        config.wavefront.environmentLighting.sunlitBaseline,
        config.sunlitBaseline
      );
      assert.ok(
        config.environmentLightSources.every((source) =>
          source.radiance.slice(0, 3).every((component) => component >= 0)
        )
      );
      assert.deepEqual(
        config.wavefront.environmentLighting.environmentMissLighting,
        config.environmentMissLighting
      );
    }
  }
});

test("environment scene presets use restrained ambient residuals", () => {
  const field = createEnvironmentLightingConfig({ preset: "grass-field-midday" });
  const warehouse = createEnvironmentLightingConfig({ preset: "warehouse-midday" });
  const studio = createEnvironmentLightingConfig({ preset: "product-studio" });
  const override = createEnvironmentLightingConfig({
    preset: "forest-midday",
    ambientColor: [0.08, 0.09, 0.1, 1],
  });

  assert.deepEqual(roundColor(field.ambientColor), [0.0374, 0.0484, 0.0312, 1]);
  assert.deepEqual(roundColor(warehouse.ambientColor), [0.0279, 0.0295, 0.0312, 1]);
  assert.ok(luminance(field.ambientColor) < luminance([0.048, 0.062, 0.04, 1]));
  assert.ok(luminance(warehouse.ambientColor) < luminance([0.034, 0.036, 0.038, 1]));
  assert.deepEqual(studio.ambientColor, [0.024, 0.027, 0.03, 1]);
  assert.deepEqual(override.ambientColor, [0.08, 0.09, 0.1, 1]);
});

test("environment presets expose time-of-day sunlit baselines", () => {
  const fieldDawn = createEnvironmentLightingConfig({ preset: "grass-field-dawn" });
  const fieldMidday = createEnvironmentLightingConfig({ preset: "grass-field-midday" });
  const fieldDusk = createEnvironmentLightingConfig({ preset: "grass-field-dusk" });
  const fieldNight = createEnvironmentLightingConfig({ preset: "grass-field-night" });
  const forestMidday = createEnvironmentLightingConfig({ preset: "forest-midday" });
  const warehouseMidday = createEnvironmentLightingConfig({ preset: "warehouse-midday" });
  const cavernMidday = createEnvironmentLightingConfig({ preset: "cavern-midday" });
  const override = createEnvironmentLightingConfig({
    preset: "cavern-night",
    sunlitBaseline: 0.21,
  });

  assert.ok(fieldMidday.sunlitBaseline > fieldDawn.sunlitBaseline);
  assert.ok(fieldDawn.sunlitBaseline > fieldDusk.sunlitBaseline);
  assert.ok(fieldDusk.sunlitBaseline > fieldNight.sunlitBaseline);
  assert.ok(forestMidday.sunlitBaseline < fieldMidday.sunlitBaseline);
  assert.ok(warehouseMidday.sunlitBaseline < forestMidday.sunlitBaseline);
  assert.ok(cavernMidday.sunlitBaseline < warehouseMidday.sunlitBaseline);
  assert.equal(override.sunlitBaseline, 0.21);
  assert.equal(override.wavefront.environmentLighting.sunlitBaseline, 0.21);
});

test("environment preset resolution accepts scene and time-of-day aliases", () => {
  const config = createEnvironmentLightingConfig({
    scene: "grass-field",
    timeOfDay: "dawn",
  });
  const defaultTimeConfig = createEnvironmentLightingConfig({
    preset: "warehouse",
  });

  assert.equal(config.preset, "grass-field-dawn");
  assert.equal(config.scene, "grass-field");
  assert.equal(config.timeOfDay, "dawn");
  assert.equal(defaultTimeConfig.preset, "warehouse-midday");
  assert.throws(
    () =>
      createEnvironmentLightingConfig({
        scene: "forest",
        timeOfDay: "afternoon",
      }),
    /timeOfDay must be one of/
  );
});

test("environment lighting sources sanitize invalid color and intensity for render checks", () => {
  const config = createEnvironmentLightingConfig({
    preset: "cavern-night",
    environmentLightSources: [
      {
        id: "broken-negative-source",
        kind: "torch",
        color: [-8, Number.NaN, 0, 1],
        intensity: -4,
        direction: [0, 0, 0],
      },
    ],
  });

  assert.equal(config.environmentLightSources.length, 1);
  assert.equal(config.dominantLightSource.id, "broken-negative-source");
  assert.ok(config.dominantLightSource.intensity > 0);
  assert.ok(config.dominantLightSource.luminance > 0);
  assert.ok(config.environmentMissLighting.color.slice(0, 3).every((component) => component > 0));
  assert.ok(config.environmentMissLighting.radiance.slice(0, 3).every((component) => component > 0));
});

test("environment lighting config normalizes window portals for environment lighting", () => {
  const config = createEnvironmentLightingConfig({
    preset: "neutral-studio",
    environmentPortals: [
      {
        id: "north-window",
        position: [0, 1.2, -2.4],
        normal: [0, 0, 1],
        tangent: [1, 0, 0],
        width: 1.8,
        height: 1.1,
        intensity: 1.4,
        color: [0.85, 0.92, 1, 0.75],
      },
    ],
  });

  assert.deepEqual(lightingEnvironmentPortalShapes, ["rectangle"]);
  assert.deepEqual(lightingEnvironmentPortalModes, [
    "disabled",
    "guide",
    "guide-and-gate",
  ]);
  assert.equal(config.environmentPortalMode, "guide-and-gate");
  assert.equal(config.environmentPortals.length, 1);
  assert.equal(config.environmentPortals[0].id, "north-window");
  assert.equal(config.environmentPortals[0].shape, "rectangle");
  assert.deepEqual(config.environmentPortals[0].position, [0, 1.2, -2.4]);
  assert.deepEqual(config.environmentPortals[0].normal, [0, 0, 1]);
  assert.deepEqual(config.environmentPortals[0].tangent, [1, 0, 0]);
  assert.deepEqual(config.environmentPortals[0].bitangent, [0, 1, 0]);
  assert.equal(config.environmentPortals[0].width, 1.8);
  assert.equal(config.environmentPortals[0].height, 1.1);
  assert.equal(config.environmentPortals[0].radianceScale, 1.4);
  assert.deepEqual(config.environmentPortals[0].color, [0.85, 0.92, 1, 0.75]);
  assert.equal(config.wavefront.environmentLighting.environmentPortalCount, 1);
});

test("wavefront environment lighting options provide renderer-ready fields", () => {
  const environmentMap = {
    id: "studio-hdri",
    projection: "equirectangular",
    width: 4,
    height: 2,
    intensity: 1.6,
    rotationRadians: 0.5,
    ambientStrength: 0.42,
  };
  const options = createWavefrontEnvironmentLightingOptions({
    preset: "moonlit-harbor",
    environmentMap,
    environmentPortalMode: "guide",
    environmentPortals: [
      {
        center: [1, 1.4, -3],
        normal: [0, 0, 1],
        halfWidth: 0.5,
        halfHeight: 0.25,
      },
    ],
  });

  assert.equal(options.lightingEnvironment.preset, "moonlit-harbor");
  assert.deepEqual(options.environmentColor, options.lightingEnvironment.environmentColor);
  assert.deepEqual(options.ambientColor, options.lightingEnvironment.ambientColor);
  assert.equal(options.environmentPortalMode, "guide");
  assert.equal(options.environmentPortals.length, 1);
  assert.equal(options.environmentPortals[0].width, 1);
  assert.equal(options.environmentPortals[0].height, 0.5);
  assert.equal(options.environmentMap.id, "studio-hdri");
  assert.equal(options.environmentMap.projection, "equirectangular");
  assert.equal(options.environmentMap.intensity, 1.6);
  assert.equal(options.environmentMap.rotationRadians, 0.5);
  assert.equal(options.environmentMap.ambientStrength, 0.42);
  assert.equal(options.sunlitBaseline, options.lightingEnvironment.sunlitBaseline);
  assert.equal(options.environmentLighting.sunlitBaseline, options.sunlitBaseline);
  assert.deepEqual(options.environmentLighting.environmentMap, options.environmentMap);
  assert.equal(options.environmentLighting.horizonColor.length, 4);
  assert.equal(options.environmentLighting.zenithColor.length, 4);
  assert.equal(options.environmentLighting.sunColor.length, 4);
});

test("environment lighting config rejects unknown presets", () => {
  assert.throws(
    () => createEnvironmentLightingConfig({ preset: "unknown" }),
    /Unknown lighting environment preset/
  );
});

test("environment lighting config rejects invalid portal settings", () => {
  assert.throws(
    () => createEnvironmentLightingConfig({ environmentPortalMode: "wrong" }),
    /environmentPortalMode must be one of/
  );
  assert.throws(
    () =>
      createEnvironmentLightingConfig({
        environmentPortals: [{ shape: "circle" }],
      }),
    /environmentPortals\[0\]\.shape must be one of/
  );
});

test("playwright capture helpers surface browser bootstrap failures and trim optional strings", () => {
  assert.equal(readOptionalString("  http://127.0.0.1:9222 "), "http://127.0.0.1:9222");
  assert.equal(readOptionalString("   "), null);
  assert.equal(
    looksLikeBrowserBootstrapFailure(
      new Error("MachPortRendezvousServer bootstrap_check_in Permission denied")
    ),
    true
  );
  assert.equal(looksLikeBrowserBootstrapFailure(new Error("ordinary timeout")), false);
});

test("playwright capture helpers normalize output directories and summarize canvas pixels", async () => {
  const tempDirectory = path.join(os.tmpdir(), "plasius-capture-helper-test");
  const defaultOutputDirectory = resolveCaptureArtifactDirectory();
  assert.ok(defaultOutputDirectory.endsWith("/output/playwright/eames-environments"));
  assert.equal(
    resolveCaptureArtifactDirectory("output/playwright/eames-environments/custom"),
    path.resolve(process.cwd(), "..", "output/playwright/eames-environments/custom")
  );
  assert.equal(resolveCaptureWorkspaceRoot(), path.resolve(process.cwd(), ".."));
  assert.equal(
    resolveCaptureArtifactDirectory(tempDirectory),
    tempDirectory
  );
  assert.equal(
    resolveCaptureBrowserProfileDirectory("/tmp/playwright", 42),
    path.join("/tmp/playwright", "plasius-playwright-eames-42")
  );

  const summary = summarizeRgbaPixels(
    new Uint8Array([
      0, 0, 0, 255,
      4, 8, 6, 255,
      12, 16, 14, 255,
      32, 48, 64, 255,
    ])
  );
  assert.equal(summary.exactBlackPixels, 1);
  assert.equal(summary.nearBlackPixels8, 2);
  assert.equal(summary.nearBlackPixels16, 3);
  assert.equal(summary.opaquePixels, 4);
  assert.ok(summary.averageLuminance > 0);

  const outputDirectory = await ensureCaptureArtifactDirectory(tempDirectory);
  assert.equal(outputDirectory, tempDirectory);
  assert.ok(fs.existsSync(outputDirectory));

  const pngBuffer = decodePngDataUrl(
    "data:image/png;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7Y6sAAAAASUVORK5CYII="
  );
  assert.ok(Buffer.isBuffer(pngBuffer));
  assert.ok(pngBuffer.length > 16);
  assert.throws(
    () => decodePngDataUrl("data:text/plain;base64,SGVsbG8="),
    /Expected a PNG data URL/
  );
});

test("playwright capture server helpers prefer reusable servers before free-port fallback", async () => {
  const checks = [];
  const selection = await findCaptureServerPort({
    startPort: 9100,
    attempts: 3,
    canReuse: async (port) => {
      checks.push(`reuse:${port}`);
      return port === 9101;
    },
    isPortFree: async (port) => {
      checks.push(`free:${port}`);
      return false;
    },
  });

  assert.deepEqual(selection, { port: 9101, reuse: true });
  assert.deepEqual(checks, ["reuse:9100", "free:9100", "reuse:9101"]);
  assert.equal(
    buildCaptureAssetUrl("http://127.0.0.1:9101"),
    "http://127.0.0.1:9101/gpu-lighting/demo/eames-environments/index.html"
  );
});

test("playwright capture server helpers fall back to a free port when no server can be reused", async () => {
  const checks = [];
  const selection = await findCaptureServerPort({
    startPort: 9200,
    attempts: 4,
    canReuse: async (port) => {
      checks.push(`reuse:${port}`);
      return false;
    },
    isPortFree: async (port) => {
      checks.push(`free:${port}`);
      return port === 9202;
    },
  });

  assert.deepEqual(selection, { port: 9202, reuse: false });
  assert.deepEqual(checks, [
    "reuse:9200",
    "free:9200",
    "reuse:9201",
    "free:9201",
    "reuse:9202",
    "free:9202",
  ]);
});

test("validation page bootstrap helpers expose explicit WebGPU diagnostics", () => {
  const runtime = {
    navigator: {
      gpu: {},
      userAgent: "Unit Test Browser",
    },
    isSecureContext: true,
    location: { href: "http://127.0.0.1:8765/demo" },
  };

  const snapshot = readWebGpuBootstrapSnapshot(runtime);
  const state = createCaptureState(runtime);
  state.step = "Creating renderer";
  state.detail = "Requesting WebGPU renderer and scene buffers.";
  const error = normalizeCaptureError(new Error("navigator.gpu missing"), state, runtime);
  const diagnostic = formatCaptureDiagnostic("grass-field-midday", {
    state,
    error,
    hudText: "Creating renderer Requesting WebGPU renderer and scene buffers.",
  });

  assert.deepEqual(snapshot, {
    hasNavigator: true,
    hasGpu: true,
    secureContext: true,
    userAgent: "Unit Test Browser",
    location: "http://127.0.0.1:8765/demo",
  });
  assert.equal(state.webgpu.hasGpu, true);
  assert.equal(error.status, "error");
  assert.match(diagnostic, /grass-field-midday failed/);
  assert.match(diagnostic, /step: Creating renderer/);
  assert.match(diagnostic, /webgpu\.hasGpu: true/);
  assert.match(diagnostic, /hud: Creating renderer Requesting WebGPU renderer and scene buffers\./);
});

test("validation page resolves capture upload URLs against the active page origin", () => {
  const runtime = {
    location: { href: "http://127.0.0.1:8011/gpu-lighting/demo/eames-environments/index.html?preset=grass-field-midday" },
  };

  assert.equal(
    resolveCaptureUploadUrl(null, runtime),
    "http://127.0.0.1:8011/__plasius-capture"
  );
  assert.equal(
    resolveCaptureUploadUrl("http://127.0.0.1:8001/__plasius-capture", runtime),
    "http://127.0.0.1:8001/__plasius-capture"
  );
  assert.equal(
    resolveCaptureUploadUrl("../capture-endpoint", runtime),
    "http://127.0.0.1:8011/gpu-lighting/demo/capture-endpoint"
  );
});

test("validation page proposes local bridge upload candidates for localhost captures", () => {
  const runtime = {
    location: { href: "http://127.0.0.1:8011/gpu-lighting/demo/eames-environments/index.html" },
  };

  assert.deepEqual(listCaptureUploadUrlCandidates(null, runtime), [
    "http://127.0.0.1:8011/__plasius-capture",
    "http://127.0.0.1:8001/__plasius-capture",
    "http://127.0.0.1:8123/__plasius-capture",
  ]);
  assert.deepEqual(
    listCaptureUploadUrlCandidates("http://127.0.0.1:9000/__plasius-capture", runtime),
    ["http://127.0.0.1:9000/__plasius-capture"]
  );
});

test("validation page reference camera is tighter than the wide orbit camera", () => {
  const referenceCamera = createEnvironmentCamera("reference", 0);
  const wideCamera = createEnvironmentCamera("wide", 0);
  const referenceDistance = Math.hypot(
    referenceCamera.position[0] - referenceCamera.target[0],
    referenceCamera.position[1] - referenceCamera.target[1],
    referenceCamera.position[2] - referenceCamera.target[2]
  );
  const wideDistance = Math.hypot(
    wideCamera.position[0] - wideCamera.target[0],
    wideCamera.position[1] - wideCamera.target[1],
    wideCamera.position[2] - wideCamera.target[2]
  );

  assert.ok(referenceDistance < wideDistance);
  assert.ok(referenceCamera.fovYDegrees < wideCamera.fovYDegrees);
});

test("validation page scales capture boot timeout with render workload", () => {
  const lowWorkloadTimeout = computeCaptureBootTimeoutMs({
    width: 640,
    height: 360,
    frames: 1,
    maxDepth: 8,
    samplesPerPixel: 1,
  });
  assert.ok(lowWorkloadTimeout > 60_000);
  assert.ok(
    computeCaptureBootTimeoutMs({ width: 640, height: 360, frames: 1, maxDepth: 8, samplesPerPixel: 32 }) >
      computeCaptureBootTimeoutMs({ width: 640, height: 360, frames: 1, maxDepth: 8, samplesPerPixel: 8 })
  );
  assert.equal(
    computeCaptureBootTimeoutMs({ width: 3840, height: 2160, frames: 8, maxDepth: 12, samplesPerPixel: 256 }),
    900_000
  );
});

test("validation page adaptive sampling controller uses gpu-performance-style ladders", () => {
  let currentLevelIndex = 5;
  const levels = [];
  const performanceModule = {
    createDeviceProfile(device) {
      return device;
    },
    createQualityLadderAdapter(options) {
      levels.push(...options.levels);
      currentLevelIndex = options.levels.length - 1;
      return {
        getCurrentLevel() {
          return options.levels[currentLevelIndex];
        },
        stepDown() {
          if (currentLevelIndex <= 0) {
            return null;
          }
          currentLevelIndex -= 1;
          return { moduleId: options.id, toLevelId: options.levels[currentLevelIndex].id };
        },
        stepUp() {
          if (currentLevelIndex >= options.levels.length - 1) {
            return null;
          }
          currentLevelIndex += 1;
          return { moduleId: options.id, toLevelId: options.levels[currentLevelIndex].id };
        },
      };
    },
    createGpuPerformanceGovernor() {
      return {
        recordFrame({ frameTimeMs }) {
          if (frameTimeMs > 20) {
            return { pressureLevel: "critical", adjustments: [{ moduleId: "eames-wavefront-samples" }] };
          }
          return { pressureLevel: "stable", adjustments: [] };
        },
      };
    },
  };

  const controller = createAdaptiveSamplingController({
    samplesPerPixel: 32,
    frameTimeBudgetMs: 16,
    minimumSamplesPerPixel: 1,
    motion: true,
    createWavefrontAdaptiveSamplingLevels() {
      return {
        requestedSamplesPerPixel: 32,
        minimumSamplesPerPixel: 1,
        frameTimeBudgetMs: 16,
        levels: [1, 2, 4, 8, 16, 32].map((samplesPerPixel) => ({
          id: `${samplesPerPixel}spp`,
          label: `${samplesPerPixel} spp`,
          estimatedCostMs: samplesPerPixel,
          config: {
            samplesPerPixel,
            frameTimeBudgetMs: 16,
            minimumSamplesPerPixel: 1,
          },
        })),
      };
    },
    performanceModule,
  });

  assert.equal(controller.enabled, true);
  assert.deepEqual(
    levels.map((level) => level.config.samplesPerPixel),
    [1, 2, 4, 8, 16, 32]
  );
  assert.equal(controller.getFrameOptions().samplesPerPixel, 32);
  controller.recordFrame({ gpuWorkerJobs: { frameTimeMs: 24 } });
  assert.equal(controller.getSnapshot().pressureLevel, "critical");
});

test("Eames glTF loader preserves UVs and material maps when textures are present", async () => {
  const positions = new Float32Array([
    -1, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0.5, 1,
  ]);
  const indices = new Uint32Array([0, 1, 2]);
  const buffer = new ArrayBuffer(
    positions.byteLength + normals.byteLength + uvs.byteLength + indices.byteLength
  );
  const bufferBytes = new Uint8Array(buffer);
  bufferBytes.set(new Uint8Array(positions.buffer), 0);
  bufferBytes.set(new Uint8Array(normals.buffer), positions.byteLength);
  bufferBytes.set(
    new Uint8Array(uvs.buffer),
    positions.byteLength + normals.byteLength
  );
  bufferBytes.set(
    new Uint8Array(indices.buffer),
    positions.byteLength + normals.byteLength + uvs.byteLength
  );

  const modelUrl = "https://example.test/eames/model.gltf";
  const modelDocument = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              TEXCOORD_0: 2,
            },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: "Leather",
        pbrMetallicRoughness: {
          baseColorFactor: [0.25, 0.2, 0.18, 1],
          metallicFactor: 0,
          roughnessFactor: 0.61,
          baseColorTexture: { index: 0, texCoord: 0 },
          metallicRoughnessTexture: { index: 1, texCoord: 0 },
        },
        normalTexture: { index: 2, texCoord: 0, scale: 0.75 },
      },
    ],
    textures: [{ source: 0 }, { source: 1 }, { source: 2 }],
    images: [
      { uri: "leather-base.png" },
      { uri: "leather-orm.png" },
      { uri: "leather-normal.png" },
    ],
    buffers: [{ uri: "mesh.bin", byteLength: buffer.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: normals.byteLength,
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength + normals.byteLength,
        byteLength: uvs.byteLength,
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength + normals.byteLength + uvs.byteLength,
        byteLength: indices.byteLength,
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC2" },
      { bufferView: 3, componentType: 5125, count: 3, type: "SCALAR" },
    ],
  };

  const previousFetch = globalThis.fetch;
  const previousCreateImageBitmap = globalThis.createImageBitmap;
  const previousOffscreenCanvas = globalThis.OffscreenCanvas;
  globalThis.fetch = async (resource) => {
    const href = String(resource);
    if (href === modelUrl) {
      return {
        ok: true,
        url: modelUrl,
        async json() {
          return modelDocument;
        },
      };
    }
    if (href === "https://example.test/eames/mesh.bin") {
      return {
        ok: true,
        url: href,
        async arrayBuffer() {
          return buffer;
        },
      };
    }
    if (
      href === "https://example.test/eames/leather-base.png" ||
      href === "https://example.test/eames/leather-orm.png" ||
      href === "https://example.test/eames/leather-normal.png"
    ) {
      return {
        ok: true,
        url: href,
        async blob() {
          return new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
        },
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  };
  globalThis.createImageBitmap = async () => ({
    width: 2,
    height: 2,
    close() {},
  });
  globalThis.OffscreenCanvas = class OffscreenCanvasMock {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }

    getContext() {
      return {
        drawImage() {},
        getImageData: () => ({
          data: new Uint8ClampedArray([
            255, 128, 64, 255,
            192, 160, 96, 255,
            128, 96, 64, 255,
            32, 16, 8, 255,
          ]),
        }),
      };
    }
  };

  try {
    const model = await loadEamesGltfModel(modelUrl);
    const primitive = model.primitives[0];

    assert.deepEqual(primitive.uvs, [0, 0, 1, 0, 0.5, 1]);
    assert.equal(primitive.material.name, "Leather");
    assert.equal(primitive.material.roughness, 0.61);
    assert.equal(primitive.material.baseColorTexture.width, 2);
    assert.equal(primitive.material.baseColorTexture.height, 2);
    assert.equal(primitive.material.metallicRoughnessTexture.width, 2);
    assert.equal(primitive.material.normalTexture.scale, 0.75);
    assert.equal(primitive.material.normalTexture.height, 2);
    assert.equal(primitive.material.baseColorTexture.data.length, 16);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.createImageBitmap = previousCreateImageBitmap;
    globalThis.OffscreenCanvas = previousOffscreenCanvas;
  }
});

test("validation scene builder can be exercised with injected runtime helpers", () => {
  const lightingOptions = createWavefrontEnvironmentLightingOptions({
    preset: "warehouse-dusk",
  });
  const model = {
    bounds: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    primitives: [
      {
        positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        material: {
          name: "chrome",
          roughness: 0.05,
          metallic: 0.9,
        },
      },
    ],
  };
  const sceneObjects = buildEnvironmentSceneObjects(
    model,
    lightingOptions,
    { showSources: true, motionPhase: 0.25 },
    {
      buildProductStudioSceneObjects() {
        return [
          { id: 1, color: [1, 1, 1, 1], materialKind: "diffuse", roughness: 1 },
          { id: 2, color: [1, 1, 1, 1], materialKind: "diffuse", roughness: 1 },
        ];
      },
    }
  );

  assert.equal(sceneObjects.length >= 2, true);
  assert.deepEqual(sceneObjects[0].color, [0.35, 0.37, 0.38, 1]);
  assert.deepEqual(sceneObjects[1].color, [0.31, 0.33, 0.35, 1]);
});

test("validation mesh builder preserves generic material inputs and texture maps", () => {
  const normalTexture = {
    texCoord: 0,
    scale: 1,
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16),
  };
  const baseColorTexture = {
    texCoord: 0,
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16),
  };
  const metallicRoughnessTexture = {
    texCoord: 0,
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16),
  };
  const emissiveTexture = {
    texCoord: 0,
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16),
  };
  const model = {
    bounds: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    primitives: [
      {
        positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        uvs: [0, 0, 1, 0, 0, 1],
        material: {
          name: "chrome",
          roughness: 0.03,
          metallic: 1,
          specular: 0.92,
          specularColor: [0.84, 0.85, 0.88],
          clearcoat: 0.02,
          clearcoatRoughness: 0.04,
          baseColorTexture,
          metallicRoughnessTexture,
          normalTexture,
          emissiveTexture,
        },
      },
      {
        positions: [-1, 0, 0, 1, 0, 0, 0, -1, 0],
        indices: [0, 1, 2],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        uvs: [0, 0, 1, 0, 0, 1],
        material: {
          name: "leather",
          roughness: 0.58,
          metallic: 0,
          sheenColor: [0.44, 0.37, 0.31],
          clearcoat: 0.16,
          clearcoatRoughness: 0.24,
          baseColorTexture,
          metallicRoughnessTexture,
          normalTexture,
        },
      },
    ],
  };

  const meshes = buildEamesMeshes(model);
  const chrome = meshes[0];
  const leather = meshes[1];

  assert.equal(chrome.materialKind, "metal");
  assert.equal(chrome.metallic, 1);
  assert.equal(chrome.specular, 0.92);
  assert.deepEqual(chrome.specularColor, [0.84, 0.85, 0.88, 1]);
  assert.equal(chrome.clearcoat, 0.02);
  assert.equal(chrome.clearcoatRoughness, 0.04);
  assert.deepEqual(chrome.uvs, [0, 0, 1, 0, 0, 1]);
  assert.equal(chrome.material.baseColorTexture, baseColorTexture);
  assert.equal(chrome.material.metallicRoughnessTexture, metallicRoughnessTexture);
  assert.equal(chrome.material.normalTexture, normalTexture);
  assert.equal(chrome.material.emissiveTexture, emissiveTexture);

  assert.equal(leather.materialKind, "diffuse");
  assert.deepEqual(leather.sheenColor, [0.44, 0.37, 0.31, 1]);
  assert.equal(leather.clearcoat, 0.16);
  assert.equal(leather.clearcoatRoughness, 0.24);
});

test("validation render decouples frame rendering from optional probe readback", async () => {
  const lightingOptions = createWavefrontEnvironmentLightingOptions({
    preset: "grass-field-midday",
  });
  let rendererOptions = null;
  const renderFrameCalls = [];
  const readProbeCalls = [];
  const renderer = {
    async renderFrame(options = {}) {
      renderFrameCalls.push(options);
      assert.equal(options.readOutputProbe, false);
      return {
        frame: 1,
        samplesPerPixel: options.samplesPerPixel ?? 4,
        triangleCount: 1,
        emissiveTriangleCount: 0,
        bvhNodeCount: 1,
        accelerationBuildMode: "gpu",
        accelerationBuildSubmitted: true,
        deferredPathResolve: true,
        gpuWorkerJobs: {
          completedPerFrame: 42,
          completedPerSecond: 420,
          completedPerSubmission: 14,
          directDispatchesCompleted: 18,
          indirectDispatchesCompleted: 24,
          frameTimeMs: 100,
          awaitedGpuCompletion: true,
        },
        gpuParallelism: { exposesMultiWorkgroupParallelism: true },
        outputProbe: null,
      };
    },
    async readOutputProbe({ x, y }) {
      readProbeCalls.push({ x, y });
      return {
        x,
        y,
        rgba: [32, 64, 128, 255],
        luminance: (0.2126 * 32 + 0.7152 * 64 + 0.0722 * 128) / 255,
      };
    },
    updateCamera() {},
    updateSceneObjects() {},
  };
  const canvas = { width: 0, height: 0 };
  const model = {
    name: "test-model",
    bounds: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
    },
    primitives: [
      {
        positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        material: {
          name: "chrome",
          roughness: 0.05,
          metallic: 0.9,
        },
      },
    ],
    indices: [0, 1, 2],
  };

  const { result } = await renderEamesEnvironment({
    canvas,
    width: 640,
    height: 480,
    frames: 1,
    maxDepth: 8,
    samplesPerPixel: 4,
    denoise: true,
    deferredPathResolve: true,
    motion: false,
    readOutputProbe: true,
    runtimeModules: {
      createWavefrontEnvironmentLightingOptions() {
        return lightingOptions;
      },
      async loadEamesGltfModel() {
        return model;
      },
      buildProductStudioSceneObjects() {
        return [
          { id: 1, color: [1, 1, 1, 1], materialKind: "diffuse", roughness: 1 },
          { id: 2, color: [1, 1, 1, 1], materialKind: "diffuse", roughness: 1 },
        ];
      },
      async createWavefrontPathTracingComputeRenderer(options = {}) {
        rendererOptions = options;
        return renderer;
      },
    },
  });

  assert.equal(renderFrameCalls.length, 1);
  assert.equal(readProbeCalls.length, 5);
  assert.equal(rendererOptions.camera.fovYDegrees, createEnvironmentCamera("reference", 0).fovYDegrees);
  assert.equal(result.cameraPreset, "reference");
  assert.equal(renderFrameCalls[0].samplesPerPixel, 4);
  assert.equal(result.renderer.outputProbe.sampledPixels, 1);
  assert.equal(result.renderer.outputProbe.nonZeroSamples, 1);
  assert.equal(result.renderer.outputProbe.maxChannel, 128);
  assert.deepEqual(result.renderer.outputProbe.rgba, [32, 64, 128, 255]);
  assert.equal(result.renderer.cameraPreset, "reference");
  assert.equal(result.renderer.targetSamplesPerPixel, 4);
  assert.equal(result.renderer.adaptiveSampling.enabled, false);
  assert.equal(result.renderer.gpuWorkerJobs.completedPerFrame, 42);
  assert.equal(result.renderer.gpuWorkerJobs.completedPerSecond, 420);
  assert.equal(result.renderer.gpuWorkerJobs.completedPerSubmission, 14);
  assert.equal(result.probeSummary.sampledPixels, 5);
});

test("module base does not use a browser-bundler asset URL pattern", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "src", "index.js"),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /new URL\(\s*(?:String\(\s*)?(?:["'`]\.\/index\.js["'`]\s*,\s*)?__IMPORT_META_URL__/,
    "browser bundlers rewrite direct new URL(import.meta.url) patterns into asset URLs"
  );
  assert.match(
    source,
    /Reflect\.construct\(\s*URL,\s*\[\s*String\(metaUrl\)\s*\]\s*\)/,
    "import metadata must be converted through an opaque constructor call"
  );
});

test("browser-like module metadata resolves technique URLs from the package", async () => {
  const module = await importLightingModuleWithBase(
    "https://lighting.example/pkg/dist/index.js",
    "browser-module-url"
  );

  assert.equal(
    module.lightingPreludeWgslUrl.href,
    "https://lighting.example/pkg/dist/techniques/hybrid/prelude.wgsl"
  );
});

test("lighting job WGSL defines process_job entry points", () => {
  for (const techniqueName of lightingTechniqueNames) {
    const technique = lightingTechniques[techniqueName];
    for (const job of technique.jobs) {
      const source = fs.readFileSync(urlToPath(job.url), "utf8");
      assert.ok(/\bfn\s+process_job\b/.test(source));
    }
  }
});

test("pathtracer prelude publishes concrete scene, history, and environment contracts", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "src",
      "techniques",
      "pathtracer",
      "prelude.wgsl"
    ),
    "utf8"
  );

  assert.match(source, /struct PathTracerCamera/);
  assert.match(source, /struct PathTracerSceneMetadata/);
  assert.match(source, /struct PathAccumulationPixel/);
  assert.match(source, /fn environment_radiance/);
});

test("pathtracer environment and emissive paths publish non-null radiance guards", () => {
  const base = path.resolve(
    __dirname,
    "..",
    "src",
    "techniques",
    "pathtracer"
  );
  const prelude = fs.readFileSync(path.join(base, "prelude.wgsl"), "utf8");
  const pathTrace = fs.readFileSync(path.join(base, "pathtrace.job.wgsl"), "utf8");

  assert.match(prelude, /fn ensure_non_null_radiance/);
  assert.match(prelude, /mode == 18u/);
  assert.match(pathTrace, /let environment_sample = environment_radiance/);
  assert.match(pathTrace, /let emissive_radiance = sanitize_radiance\(material\.emission\)/);
  assert.match(pathTrace, /luminance\(emissive_radiance\) > 0\.0001/);
});

test("reference pathtracer WGSL stages are real kernels rather than placeholders", () => {
  const base = path.resolve(
    __dirname,
    "..",
    "src",
    "techniques",
    "pathtracer"
  );
  const pathTrace = fs.readFileSync(path.join(base, "pathtrace.job.wgsl"), "utf8");
  const accumulate = fs.readFileSync(path.join(base, "accumulate.job.wgsl"), "utf8");
  const denoise = fs.readFileSync(path.join(base, "denoise.job.wgsl"), "utf8");

  assert.match(pathTrace, /@compute\s+@workgroup_size/);
  assert.match(pathTrace, /fn trace_scene\b/);
  assert.match(pathTrace, /samples_per_pixel/);
  assert.match(pathTrace, /max_bounces/);
  assert.doesNotMatch(pathTrace, /Placeholder/);

  assert.match(accumulate, /PathAccumulationPixel/);
  assert.match(accumulate, /history_blend/);
  assert.doesNotMatch(accumulate, /Placeholder/);

  assert.match(denoise, /fn bilateral_weight\b/);
  assert.match(denoise, /filtered_radiance/);
  assert.doesNotMatch(denoise, /Placeholder/);
});

test("hybrid reflection resolve WGSL traces and shapes reflections by surface response", () => {
  const prelude = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "src",
      "techniques",
      "hybrid",
      "prelude.wgsl"
    ),
    "utf8"
  );
  const resolve = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "src",
      "techniques",
      "hybrid",
      "reflection-resolve.job.wgsl"
    ),
    "utf8"
  );

  assert.match(prelude, /struct HybridReflectionSurface/);
  assert.match(prelude, /struct HybridReflectionPixel/);
  assert.match(resolve, /fn trace_reflection_scene\b/);
  assert.match(resolve, /reflect\(/);
  assert.match(resolve, /HybridReflectionPixel/);
  assert.doesNotMatch(resolve, /Placeholder/);
});

test("hybrid realtime WGSL stages are real kernels rather than placeholders", () => {
  const base = path.resolve(
    __dirname,
    "..",
    "src",
    "techniques",
    "hybrid"
  );
  const directLighting = fs.readFileSync(
    path.join(base, "direct-lighting.job.wgsl"),
    "utf8"
  );
  const screenTrace = fs.readFileSync(
    path.join(base, "screen-trace.job.wgsl"),
    "utf8"
  );
  const radianceCache = fs.readFileSync(
    path.join(base, "radiance-cache.job.wgsl"),
    "utf8"
  );
  const finalGather = fs.readFileSync(
    path.join(base, "final-gather.job.wgsl"),
    "utf8"
  );

  assert.match(directLighting, /HybridLightingPixel/);
  assert.match(directLighting, /evaluate_direct_sun/);
  assert.match(directLighting, /@compute\s+@workgroup_size/);
  assert.doesNotMatch(directLighting, /Placeholder/);

  assert.match(screenTrace, /trace_screen_scene/);
  assert.match(screenTrace, /HybridScreenTracePixel/);
  assert.match(screenTrace, /HybridReflectionTrace/);
  assert.doesNotMatch(screenTrace, /Placeholder/);

  assert.match(radianceCache, /HybridRadianceCacheEntry/);
  assert.match(radianceCache, /resolved_irradiance/);
  assert.match(radianceCache, /history_weight/);
  assert.doesNotMatch(radianceCache, /Placeholder/);

  assert.match(finalGather, /HybridLightingPixel/);
  assert.match(finalGather, /indirect_gi/);
  assert.match(finalGather, /reflection_term/);
  assert.doesNotMatch(finalGather, /Placeholder/);
});

test("lighting profiles reference known techniques", () => {
  assert.ok(lightingProfileNames.length > 0);
  for (const profileName of lightingProfileNames) {
    const profile = lightingProfiles[profileName];
    assert.ok(profile, `Missing profile: ${profileName}`);
    for (const techniqueName of profile.techniques) {
      assert.ok(
        lightingTechniqueNames.includes(techniqueName),
        `Unknown technique ${techniqueName} in profile ${profileName}`
      );
    }
  }
});

test("adaptive lighting profile defaults keep reference mode eligible at a 30 FPS four-frame floor", () => {
  assert.deepEqual(lightingProfileModeOrder, [
    "realtime",
    "hybrid",
    "reference",
  ]);
  assert.deepEqual(defaultAdaptiveLightingProfilePolicy, {
    preferredProfile: "reference",
    minimumFrameRate: 30,
    sampleWindowSize: 4,
  });

  const ladder = createLightingProfileModeLadder();

  assert.equal(ladder.id, "lighting-profile-mode");
  assert.equal(ladder.domain, "lighting");
  assert.equal(ladder.authority, "visual");
  assert.equal(ladder.importance, "critical");
  assert.equal(ladder.initialLevel, "reference");
  assert.deepEqual(
    ladder.levels.map((level) => level.id),
    lightingProfileModeOrder
  );
  assert.equal(ladder.target.minimumFrameRate, 30);
  assert.equal(ladder.target.maximumFrameRate, 30);
  assert.deepEqual(ladder.target.preferredFrameRates, [30]);
  assert.equal(ladder.adaptation.sampleWindowSize, 4);
  assert.equal(ladder.adaptation.minimumSamplesBeforeAdjustment, 4);
  assert.equal(ladder.policy.preferredProfile, "reference");

  const referenceLevel = ladder.levels.find((level) => level.id === "reference");
  assert.ok(referenceLevel);
  assert.equal(referenceLevel.config.profile, "reference");
  assert.ok(referenceLevel.config.techniques.includes("pathtracer"));
  assert.equal(referenceLevel.config.lightingBandPlan.profile, "reference");
});

test("adaptive lighting profile ladder supports custom governor window and initial profile overrides", () => {
  const ladder = createLightingProfileModeLadder({
    id: "game-lighting-profile-mode",
    initialProfile: "hybrid",
    preferredProfile: "reference",
    minimumFrameRate: 36,
    sampleWindowSize: 6,
    importance: "critical",
    moduleImportance: "high",
  });

  assert.equal(ladder.id, "game-lighting-profile-mode");
  assert.equal(ladder.initialLevel, "hybrid");
  assert.equal(ladder.importance, "high");
  assert.equal(ladder.target.minimumFrameRate, 36);
  assert.equal(ladder.adaptation.sampleWindowSize, 6);
  assert.equal(ladder.policy.sampleWindowSize, 6);
  assert.equal(ladder.levels[2].config.lightingBandPlan.importance, "critical");
});

test("loading default profile returns loaded technique bundles", async () => {
  const profile = getLightingProfile(defaultLightingProfile);
  const loaded = await loadLightingProfile(defaultLightingProfile);
  assert.equal(loaded.profile.name, defaultLightingProfile);
  assert.equal(loaded.techniques.length, profile.techniques.length);
  for (const entry of loaded.techniques) {
    assert.equal(typeof entry.preludeWgsl, "string");
    assert.ok(entry.preludeWgsl.length > 0);
    assert.ok(Array.isArray(entry.jobs));
    assert.ok(entry.jobs.length > 0);
    for (const job of entry.jobs) {
      assert.equal(typeof job.wgsl, "string");
      assert.ok(job.wgsl.length > 0);
    }
  }
});

test("hybrid prelude defines frame params", () => {
  const preludePath = path.resolve(
    __dirname,
    "..",
    "src",
    "techniques",
    "hybrid",
    "prelude.wgsl"
  );
  const source = fs.readFileSync(preludePath, "utf8");
  assert.ok(source.includes("struct HybridFrameParams"));
});

test("lookup APIs reject unknown technique/profile names", async () => {
  assert.throws(
    () => getLightingTechnique("unknown-technique"),
    /Unknown lighting technique/
  );
  assert.throws(
    () => getLightingProfile("unknown-profile"),
    /Unknown lighting profile/
  );
  await assert.rejects(
    () => loadLightingProfile("unknown-profile"),
    /Unknown lighting profile/
  );
});

test("job lookup rejects unknown job key", async () => {
  await assert.rejects(
    () => loadLightingTechniqueJobWgsl("hybrid", "unknown-job"),
    /Unknown job/
  );
});

test("default wrapper loaders return hybrid prelude and jobs", async () => {
  const prelude = await loadLightingPreludeWgsl();
  assert.equal(typeof prelude, "string");
  assert.ok(prelude.includes("struct HybridFrameParams"));

  const loaded = await loadLightingJobs();
  assert.equal(Array.isArray(loaded.jobs), true);
  assert.ok(loaded.jobs.length > 0);
  assert.ok(loaded.jobs.every((job) => typeof job.wgsl === "string"));
});

test("technique-specific loader APIs return expected bundles", async () => {
  const prelude = await loadLightingTechniquePreludeWgsl("volumetrics");
  assert.ok(prelude.includes("struct FroxelGridParams"));

  const job = await loadLightingTechniqueJobWgsl("hdri", "brdfLut");
  assert.ok(job.includes("process_job"));

  const bundle = await loadLightingTechniqueJobs("pathtracer");
  assert.equal(bundle.jobs.length, 3);
});

test("lighting worker manifests expose performance and debug contracts", () => {
  const manifest = getLightingTechniqueWorkerManifest("hybrid");
  assert.equal(manifest.owner, "lighting");
  assert.equal(manifest.queueClass, "lighting");
  assert.equal(manifest.schedulerMode, "dag");
  assert.equal(manifest.jobs.length, lightingTechniques.hybrid.jobs.length);

  const screenTrace = manifest.jobs.find((job) => job.key === "screenTrace");
  const finalGather = manifest.jobs.find((job) => job.key === "finalGather");
  assert.equal(screenTrace.worker.jobType, "lighting.hybrid.screenTrace");
  assert.equal(screenTrace.worker.priority, 3);
  assert.deepEqual(screenTrace.worker.dependencies, []);
  assert.equal(screenTrace.performance.domain, "reflections");
  assert.equal(screenTrace.performance.levels[0].id, "low");
  assert.equal(screenTrace.debug.owner, "lighting");
  assert.ok(screenTrace.debug.suggestedAllocationIds.includes("lighting.hybrid.reflection-history"));
  assert.deepEqual(finalGather.worker.dependencies, [
    "lighting.hybrid.radianceCache",
    "lighting.hybrid.screenTrace",
  ]);
});

test("profile worker manifest aggregates technique manifests", () => {
  const manifest = getLightingProfileWorkerManifest("realtime");
  assert.equal(manifest.profile, "realtime");
  assert.equal(manifest.schedulerMode, "dag");
  assert.equal(manifest.techniques.length, 3);
  assert.ok(manifest.jobs.length >= manifest.techniques.length);
});

test("worker bundle loaders pair WGSL with governance metadata", async () => {
  const bundle = await loadLightingTechniqueWorkerBundle("volumetrics");
  assert.equal(bundle.technique, "volumetrics");
  assert.equal(bundle.jobs.length, 2);
  assert.equal(bundle.workerManifest.jobs.length, 2);

  const profilePlan = await loadLightingProfileWorkerPlan("reference");
  assert.equal(profilePlan.profile.name, "reference");
  assert.equal(profilePlan.techniques.length, 3);
  assert.equal(profilePlan.workerManifest.profile, "reference");
});

test("fetcher branch supports non-file technique URLs", async () => {
  const module = await importLightingModuleWithBase(
    new URL("https://lighting.example/pkg/index.js"),
    "fetch-success"
  );

  const prelude = await module.loadLightingTechniquePreludeWgsl("hybrid", {
    fetcher: async () => ({
      ok: true,
      async text() {
        return "@group(0) @binding(0) var<uniform> frameParams: vec4f;";
      },
    }),
  });

  assert.ok(prelude.includes("frameParams"));
});

test("fetcher branch surfaces HTTP failure details", async () => {
  const module = await importLightingModuleWithBase(
    new URL("https://lighting.example/pkg/index.js"),
    "fetch-error"
  );

  await assert.rejects(
    () =>
      module.loadLightingTechniquePreludeWgsl("hybrid", {
        fetcher: async () => ({
          ok: false,
          status: 503,
          statusText: "Unavailable",
        }),
      }),
    /Failed to load WGSL \(503 Unavailable\)/
  );
});

test("fetcher branch rejects HTML payloads", async () => {
  const module = await importLightingModuleWithBase(
    new URL("https://lighting.example/pkg/index.js"),
    "fetch-html"
  );

  await assert.rejects(
    () =>
      module.loadLightingTechniquePreludeWgsl("hybrid", {
        fetcher: async () => ({
          ok: true,
          async text() {
            return "<!doctype html><html><body>not wgsl</body></html>";
          },
        }),
      }),
    /Expected WGSL/
  );
});
