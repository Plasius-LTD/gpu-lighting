const WORKSPACE_ROOT_URL = new URL("../../../", import.meta.url);
const PACKAGE_ROOT_URL = new URL("../../", import.meta.url);
const MODULE_VERSION = new URLSearchParams(globalThis.location?.search ?? "").get("moduleVersion") ?? "1";

function resolveRepoUrl(relativePath) {
  return new URL(relativePath, WORKSPACE_ROOT_URL).href;
}

function resolvePackageUrl(relativePath) {
  return new URL(relativePath, PACKAGE_ROOT_URL).href;
}

function withModuleVersion(url) {
  const resolved = new URL(url);
  resolved.searchParams.set("module-version", MODULE_VERSION);
  return resolved.href;
}

export const MODEL_URL = resolvePackageUrl(
  "data/models/eames-lounge-chair-ottoman/Eames_Lounge_Chair_Ottoman.gltf"
);
export const CAPTURE_BOOT_TIMEOUT_MS = 60_000;
export const MAX_CAPTURE_BOOT_TIMEOUT_MS = 900_000;
const runtimeModuleUrls = Object.freeze({
  renderer: withModuleVersion(`${resolveRepoUrl("gpu-renderer/dist/index.js")}?terminal-environment-fallback=1`),
  scene: withModuleVersion(resolveRepoUrl("gpu-shared/src/product-studio-runtime.js")),
  lighting: withModuleVersion(resolveRepoUrl("gpu-lighting/dist/index.js")),
  performance: withModuleVersion(resolveRepoUrl("gpu-performance/dist/index.js")),
  loader: withModuleVersion(new URL("./eames-loader.js", import.meta.url).href),
});
const SCENE_SURFACES = Object.freeze({
  "grass-field": Object.freeze({
    floor: [0.19, 0.34, 0.12, 1],
    wall: [0.34, 0.49, 0.34, 1],
  }),
  forest: Object.freeze({
    floor: [0.13, 0.22, 0.1, 1],
    wall: [0.14, 0.25, 0.16, 1],
  }),
  warehouse: Object.freeze({
    floor: [0.35, 0.37, 0.38, 1],
    wall: [0.31, 0.33, 0.35, 1],
  }),
  cavern: Object.freeze({
    floor: [0.17, 0.16, 0.14, 1],
    wall: [0.14, 0.13, 0.13, 1],
  }),
});
const LOOPBACK_CAPTURE_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function readNumberParam(params, name, fallback, minimum, maximum) {
  const rawValue = params.get(name);
  if (typeof rawValue !== "string" || rawValue.trim().length <= 0) {
    return fallback;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function computeCaptureBootTimeoutMs(options = {}) {
  const width = Math.max(1, Number(options.width ?? 1280));
  const height = Math.max(1, Number(options.height ?? 720));
  const frames = Math.max(1, Number(options.frames ?? 1));
  const maxDepth = Math.max(1, Number(options.maxDepth ?? 3));
  const samplesPerPixel = Math.max(1, Number(options.samplesPerPixel ?? 8));
  const tileEstimate = Math.max(1, Math.ceil(width / 128) * Math.ceil(height / 128));
  const perSamplePassEstimate = maxDepth + 2;
  const workEstimate = frames * samplesPerPixel * perSamplePassEstimate * tileEstimate;
  return Math.min(
    MAX_CAPTURE_BOOT_TIMEOUT_MS,
    CAPTURE_BOOT_TIMEOUT_MS + workEstimate * 30
  );
}

export function readWebGpuBootstrapSnapshot(runtime = globalThis) {
  const navigatorObject = runtime?.navigator ?? null;
  return {
    hasNavigator: navigatorObject !== null,
    hasGpu: navigatorObject?.gpu != null,
    secureContext: runtime?.isSecureContext === true,
    userAgent: typeof navigatorObject?.userAgent === "string" ? navigatorObject.userAgent : null,
    location: typeof runtime?.location?.href === "string" ? runtime.location.href : null,
  };
}

export function createCaptureState(runtime = globalThis) {
  return {
    startedAt: Date.now(),
    step: "booting",
    detail: "Preparing Eames environment render.",
    webgpu: readWebGpuBootstrapSnapshot(runtime),
  };
}

function setCaptureStep(state, step, detail, hud) {
  state.step = step;
  state.detail = detail;
  state.updatedAt = Date.now();
  state.webgpu = readWebGpuBootstrapSnapshot(globalThis);
  if (hud) {
    hud.innerHTML = `
      <strong>${step}</strong>
      <span>${detail}</span>
    `;
  }
}

function freezeCanvasForCapture(canvas) {
  if (!canvas || typeof canvas.toDataURL !== "function") {
    return null;
  }
  const dataUrl = canvas.toDataURL("image/png");
  if (typeof dataUrl !== "string" || dataUrl.length <= 32) {
    return null;
  }
  const frozenImage = document.createElement("img");
  frozenImage.src = dataUrl;
  frozenImage.alt = "Frozen validation render";
  frozenImage.setAttribute(
    "style",
    [
      "position:absolute",
      "inset:0",
      "inline-size:100%",
      "block-size:100%",
      "display:block",
      "object-fit:fill",
      "z-index:0",
    ].join(";")
  );
  canvas.insertAdjacentElement("afterend", frozenImage);
  canvas.style.display = "none";
  return dataUrl;
}

function delayMilliseconds(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

export function resolveCaptureUploadUrl(uploadUrl, runtime = globalThis) {
  const baseHref =
    typeof runtime?.location?.href === "string" && runtime.location.href.length > 0
      ? runtime.location.href
      : "http://127.0.0.1/";
  const target = typeof uploadUrl === "string" && uploadUrl.trim().length > 0
    ? uploadUrl
    : "/__plasius-capture";
  return new URL(target, baseHref).href;
}

function isLoopbackCaptureHostname(hostname) {
  return LOOPBACK_CAPTURE_HOSTNAMES.has(String(hostname ?? "").toLowerCase());
}

export function assertLocalCaptureUploadUrl(uploadUrl, runtime = globalThis) {
  const resolvedUrl = new URL(resolveCaptureUploadUrl(uploadUrl, runtime));
  if (!["http:", "https:"].includes(resolvedUrl.protocol)) {
    throw new Error(`Capture upload URL must use http or https: ${resolvedUrl.href}`);
  }
  if (!isLoopbackCaptureHostname(resolvedUrl.hostname)) {
    throw new Error(
      `Capture upload URL must target a local loopback bridge: ${resolvedUrl.href}`
    );
  }
  return resolvedUrl.href;
}

export function listCaptureUploadUrlCandidates(uploadUrl, runtime = globalThis) {
  const primaryUrl = assertLocalCaptureUploadUrl(uploadUrl, runtime);
  const candidates = [primaryUrl];
  if (typeof uploadUrl === "string" && uploadUrl.trim().length > 0) {
    return candidates;
  }
  const locationHref =
    typeof runtime?.location?.href === "string" && runtime.location.href.length > 0
      ? runtime.location.href
      : null;
  if (!locationHref) {
    return candidates;
  }
  const locationUrl = new URL(locationHref);
  if (!["127.0.0.1", "localhost"].includes(locationUrl.hostname)) {
    return candidates;
  }
  for (const port of ["8001", "8123"]) {
    if (locationUrl.port === port) {
      continue;
    }
    candidates.push(`http://127.0.0.1:${port}/__plasius-capture`);
  }
  return [...new Set(candidates)];
}

async function discoverCaptureUploadUrl(uploadUrl, runtime = globalThis) {
  const candidates = listCaptureUploadUrlCandidates(uploadUrl, runtime);
  const fetchFn =
    typeof runtime?.fetch === "function"
      ? runtime.fetch.bind(runtime)
      : typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : null;
  if (fetchFn === null || candidates.length <= 1) {
    return candidates[0];
  }
  for (const candidate of candidates) {
    try {
      const response = await fetchFn(candidate, {
        method: "OPTIONS",
        headers: {
          "content-type": "application/json",
        },
      });
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Try the next local bridge candidate.
    }
  }
  return candidates[0];
}

async function uploadCaptureArtifact(uploadPath, imageDataUrl, result, options = {}) {
  const uploadUrl = await discoverCaptureUploadUrl(options.uploadUrl, options.runtime);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path: uploadPath,
      dataUrl: imageDataUrl,
      result,
    }),
  });
  if (!response.ok) {
    if (response.status === 405 || response.status === 501) {
      throw new Error(
        `Capture upload failed with status ${response.status}. Start capture-bridge-server and pass captureUploadUrl=http://127.0.0.1:<port>/__plasius-capture when serving the page from a static server.`
      );
    }
    throw new Error(`Capture upload failed with status ${response.status}.`);
  }
  return response.json();
}
export function normalizeCaptureError(error, state = null, runtime = globalThis) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return {
    status: "error",
    message,
    state,
    webgpu: readWebGpuBootstrapSnapshot(runtime),
  };
}

export async function loadCaptureRuntimeModules() {
  const [rendererModule, sceneModule, lightingModule, performanceModule, loaderModule] = await Promise.all([
    import(runtimeModuleUrls.renderer),
    import(runtimeModuleUrls.scene),
    import(runtimeModuleUrls.lighting),
    import(runtimeModuleUrls.performance),
    import(runtimeModuleUrls.loader),
  ]);
  return Object.freeze({
    createWavefrontAdaptiveSamplingLevels: rendererModule.createWavefrontAdaptiveSamplingLevels,
    createWavefrontPathTracingComputeRenderer: rendererModule.createWavefrontPathTracingComputeRenderer,
    buildProductStudioSceneObjects: sceneModule.buildProductStudioSceneObjects,
    createWavefrontEnvironmentLightingOptions: lightingModule.createWavefrontEnvironmentLightingOptions,
    createDeviceProfile: performanceModule.createDeviceProfile,
    createGpuPerformanceGovernor: performanceModule.createGpuPerformanceGovernor,
    createQualityLadderAdapter: performanceModule.createQualityLadderAdapter,
    loadEamesGltfModel: loaderModule.loadEamesGltfModel,
  });
}

function normalizePositiveInteger(value, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(Number(value))));
}

export function createAdaptiveSamplingController(options = {}) {
  const samplingPlan =
    typeof options.createWavefrontAdaptiveSamplingLevels === "function"
      ? options.createWavefrontAdaptiveSamplingLevels({
          samplesPerPixel: options.samplesPerPixel ?? 1,
          frameTimeBudgetMs: options.frameTimeBudgetMs ?? 0,
          minimumSamplesPerPixel: options.minimumSamplesPerPixel ?? 1,
        })
      : null;
  const requestedSamplesPerPixel = normalizePositiveInteger(
    samplingPlan?.requestedSamplesPerPixel ?? options.samplesPerPixel ?? 1,
    1,
    256
  );
  const frameTimeBudgetMs = Math.max(
    0,
    Number(samplingPlan?.frameTimeBudgetMs ?? options.frameTimeBudgetMs ?? 0)
  );
  const minimumSamplesPerPixel = normalizePositiveInteger(
    samplingPlan?.minimumSamplesPerPixel ?? options.minimumSamplesPerPixel ?? 1,
    1,
    requestedSamplesPerPixel
  );
  const performanceModule = options.performanceModule ?? null;
  const governorAvailable =
    Array.isArray(samplingPlan?.levels) &&
    typeof performanceModule?.createDeviceProfile === "function" &&
    typeof performanceModule?.createGpuPerformanceGovernor === "function" &&
    typeof performanceModule?.createQualityLadderAdapter === "function";
  const enabled =
    governorAvailable &&
    frameTimeBudgetMs > 0 &&
    requestedSamplesPerPixel > minimumSamplesPerPixel;

  if (!enabled) {
    return {
      enabled: false,
      getFrameOptions() {
        return {
          samplesPerPixel: requestedSamplesPerPixel,
          frameTimeBudgetMs: frameTimeBudgetMs > 0 ? frameTimeBudgetMs : undefined,
          minimumSamplesPerPixel:
            frameTimeBudgetMs > 0 ? minimumSamplesPerPixel : undefined,
        };
      },
      recordFrame() {
        return null;
      },
      getSnapshot() {
        return {
          enabled: false,
          requestedSamplesPerPixel,
          targetSamplesPerPixel: requestedSamplesPerPixel,
          currentLevelId: `${requestedSamplesPerPixel}spp`,
          pressureLevel: null,
          frameTimeBudgetMs: frameTimeBudgetMs > 0 ? frameTimeBudgetMs : null,
        };
      },
    };
  }
  const ladder = performanceModule.createQualityLadderAdapter({
    id: "eames-wavefront-samples",
    domain: "reflections",
    authority: "visual",
    importance: "high",
    representationBand: "near",
    qualityDimensions: {
      rayTracing: 1,
      lightingSamples: 1,
      temporalReuse: options.motion === true ? 0 : 1,
    },
    importanceSignals: {
      visible: true,
      playerRelevant: true,
      imageCritical: true,
      motionClass: options.motion === true ? "volatile" : "stable",
      reflectionSignificance: "high",
    },
    levels: samplingPlan.levels,
  });
  const governor = performanceModule.createGpuPerformanceGovernor({
    device: performanceModule.createDeviceProfile({
      deviceClass: "desktop",
      mode: "flat",
      refreshRateHz: Number.isFinite(options.refreshRateHz)
        ? Math.max(30, Number(options.refreshRateHz))
        : 60,
      supportsWebGpu: true,
      gpuTier: "high",
    }),
    modules: [ladder],
  });
  let lastDecision = null;

  return {
    enabled: true,
    getFrameOptions() {
      const currentLevel = ladder.getCurrentLevel().config;
      return {
        samplesPerPixel: currentLevel.samplesPerPixel,
        frameTimeBudgetMs: currentLevel.frameTimeBudgetMs,
        minimumSamplesPerPixel: currentLevel.minimumSamplesPerPixel,
      };
    },
    recordFrame(stats = {}) {
      const frameTimeMs = Number(
        stats?.gpuWorkerJobs?.frameTimeMs ?? stats?.frameTimeMs ?? 0
      );
      if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
        return null;
      }
      lastDecision = governor.recordFrame({ frameTimeMs });
      return lastDecision;
    },
    getSnapshot() {
      const currentLevel = ladder.getCurrentLevel();
      return {
        enabled: true,
        requestedSamplesPerPixel,
        targetSamplesPerPixel: currentLevel.config.samplesPerPixel,
        currentLevelId: currentLevel.id,
        pressureLevel: lastDecision?.pressureLevel ?? "stable",
        frameTimeBudgetMs,
      };
    },
  };
}

function readBoundsCenter(bounds) {
  return [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ];
}

function readBoundsExtent(bounds) {
  return [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
}

function createModelTransform(model, options = {}) {
  const center = readBoundsCenter(model.bounds);
  const extent = readBoundsExtent(model.bounds);
  const maxExtent = Math.max(extent[0], extent[1], extent[2], 0.001);
  const scale = Number(options.productScale ?? 1.75) / maxExtent;
  const target = options.productTarget ?? [0, -0.18, -1.32];
  return (point) => [
    (point[0] - center[0]) * scale + target[0],
    (point[1] - center[1]) * scale + target[1],
    (point[2] - center[2]) * scale + target[2],
  ];
}

function transformPositions(positions, transformPoint) {
  const transformed = [];
  for (let index = 0; index < positions.length; index += 3) {
    const point = transformPoint([positions[index], positions[index + 1], positions[index + 2]]);
    transformed.push(point[0], point[1], point[2]);
  }
  return transformed;
}

function resolveMaterialColor(material) {
  const color = material?.color ?? { r: 0.56, g: 0.33, b: 0.22, a: 1 };
  return [color.r, color.g, color.b, material?.opacity ?? color.a ?? 1];
}

function resolveMaterialKind(material) {
  const emission = material?.emissive ?? { r: 0, g: 0, b: 0 };
  const emissionLuminance = (emission.r ?? 0) + (emission.g ?? 0) + (emission.b ?? 0);
  if (emissionLuminance > 0.0001) {
    return "emissive";
  }
  if ((material?.transmission ?? 0) > 0.001 || (material?.opacity ?? material?.color?.a ?? 1) < 0.999) {
    return "transparent";
  }
  if ((material?.metallic ?? 0) >= 0.5) {
    return "metal";
  }
  return "diffuse";
}

function resolveMaterialEmission(material) {
  const emissive = material?.emissive ?? { r: 0, g: 0, b: 0, a: 1 };
  return [emissive.r ?? 0, emissive.g ?? 0, emissive.b ?? 0, emissive.a ?? 1];
}

function resolveMaterialSpecularColor(material) {
  if (Array.isArray(material?.specularColor) && material.specularColor.length >= 3) {
    return [material.specularColor[0], material.specularColor[1], material.specularColor[2], 1];
  }
  return [1, 1, 1, 1];
}

function resolveMaterialSheenColor(material) {
  if (Array.isArray(material?.sheenColor) && material.sheenColor.length >= 3) {
    return [material.sheenColor[0], material.sheenColor[1], material.sheenColor[2], 1];
  }
  return [0, 0, 0, 1];
}

export function buildEamesMeshes(model, options = {}) {
  const transformPoint = createModelTransform(model, options);
  return model.primitives.map((primitive, index) => {
    const material = primitive.material ?? null;
    return {
      id: index + 1,
      positions: transformPositions(primitive.positions, transformPoint),
      indices: primitive.indices,
      normals: primitive.normals,
      uvs: primitive.uvs ?? null,
      color: resolveMaterialColor(material),
      emission: resolveMaterialEmission(material),
      materialKind: resolveMaterialKind(material),
      roughness: typeof material?.roughness === "number" ? material.roughness : 0.72,
      metallic: typeof material?.metallic === "number" ? material.metallic : 0,
      opacity: typeof material?.opacity === "number" ? material.opacity : material?.color?.a ?? 1,
      ior: typeof material?.ior === "number" ? material.ior : 1.45,
      specular: typeof material?.specular === "number" ? material.specular : 1,
      specularColor: resolveMaterialSpecularColor(material),
      sheenColor: resolveMaterialSheenColor(material),
      clearcoat: typeof material?.clearcoat === "number" ? material.clearcoat : 0,
      clearcoatRoughness:
        typeof material?.clearcoatRoughness === "number" ? material.clearcoatRoughness : 0.08,
      transmission: typeof material?.transmission === "number" ? material.transmission : 0,
      material: {
        baseColorTexture: primitive.material?.baseColorTexture ?? null,
        metallicRoughnessTexture: primitive.material?.metallicRoughnessTexture ?? null,
        normalTexture: primitive.material?.normalTexture ?? null,
        occlusionTexture: primitive.material?.occlusionTexture ?? null,
        emissiveTexture: primitive.material?.emissiveTexture ?? null,
      },
    };
  });
}

function scaledEmission(source, scale = 1.9) {
  const color = source.color ?? [1, 1, 1, 1];
  const intensity = Math.max(source.intensity ?? 1, 0.05) * scale;
  return [
    Math.min(64, color[0] * intensity),
    Math.min(64, color[1] * intensity),
    Math.min(64, color[2] * intensity),
    1,
  ];
}

function sourcePosition(source, index) {
  if (Array.isArray(source.position)) {
    return source.position;
  }
  const direction = Array.isArray(source.direction) ? source.direction : [0, 1, 0];
  return [
    direction[0] * 1.65 + (index % 3 - 1) * 0.18,
    Math.max(0.18, direction[1] * 1.1 + 0.78),
    -1.55 + direction[2] * 1.05,
  ];
}

function animatedPosition(position, index, motionPhase = 0) {
  if (!Number.isFinite(motionPhase) || motionPhase === 0) {
    return position;
  }
  const angle = motionPhase * Math.PI * 2 + index * 0.73;
  return [
    position[0] + Math.sin(angle) * 0.08,
    position[1] + Math.sin(angle * 0.7) * 0.035,
    position[2] + Math.cos(angle) * 0.08,
  ];
}

function createWideOrbitCamera(motionPhase = 0) {
  const angle = (motionPhase - 0.5) * 0.18;
  const radius = 5.6;
  const target = [0, 0.58, -0.08];
  return {
    position: [
      Math.sin(angle) * radius,
      1.15 + Math.sin(motionPhase * Math.PI * 2) * 0.045,
      Math.cos(angle) * radius,
    ],
    target,
    up: [0, 1, 0],
    fovYDegrees: 46,
  };
}

function createReferenceComparisonCamera(motionPhase = 0) {
  const phase = Number.isFinite(motionPhase) ? motionPhase : 0;
  const angle = 0.78 + (phase - 0.5) * 0.09;
  const radius = 2.48;
  const target = [0.14, 0.2, -1.08];
  return {
    position: [
      Math.sin(angle) * radius,
      0.82 + Math.sin(phase * Math.PI * 2) * 0.03,
      Math.cos(angle) * radius + 0.06,
    ],
    target,
    up: [0, 1, 0],
    fovYDegrees: 27,
  };
}

export function createEnvironmentCamera(cameraPreset = "reference", motionPhase = 0) {
  switch (String(cameraPreset ?? "reference").trim().toLowerCase()) {
    case "wide":
    case "orbit":
      return createWideOrbitCamera(motionPhase);
    case "reference":
    case "comparison":
    default:
      return createReferenceComparisonCamera(motionPhase);
  }
}

function sourceMarker(source, index, motionPhase = 0) {
  const kind = String(source.kind ?? "source");
  const role = String(source.role ?? "light");
  const emission = scaledEmission(source);
  const color = source.color ?? [1, 1, 1, 1];
  const position = animatedPosition(sourcePosition(source, index), index, motionPhase);
  if (
    kind.includes("fluorescent") ||
    kind.includes("portal") ||
    kind.includes("door") ||
    kind.includes("cave-mouth") ||
    kind.includes("horizon")
  ) {
    return {
      kind: "box",
      center: position,
      halfExtent: kind.includes("fluorescent") ? [0.72, 0.035, 0.035] : [0.22, 0.16, 0.035],
      color,
      emission,
      materialKind: "emissive",
      id: 400 + index,
      label: `${kind}:${role}`,
    };
  }
  if (kind.includes("lava")) {
    return {
      kind: "box",
      center: [position[0], -0.72, -1.12],
      halfExtent: [0.48, 0.035, 0.12],
      color,
      emission,
      materialKind: "emissive",
      id: 400 + index,
      label: `${kind}:${role}`,
    };
  }
  return {
    kind: "sphere",
    center: position,
    radius: kind.includes("sun") || kind.includes("moon") ? 0.14 : 0.09,
    color,
    emission,
    materialKind: "emissive",
    id: 400 + index,
    label: `${kind}:${role}`,
  };
}

export function buildEnvironmentSceneObjects(model, lightingOptions, options = {}, runtimeModules = {}) {
  const buildSceneObjects = runtimeModules.buildProductStudioSceneObjects;
  if (typeof buildSceneObjects !== "function") {
    throw new Error("buildEnvironmentSceneObjects requires buildProductStudioSceneObjects.");
  }
  const baseSceneObjects = buildSceneObjects(model).slice(0, 2);
  const scene = lightingOptions.lightingEnvironment.scene;
  const surfaces = SCENE_SURFACES[scene] ?? SCENE_SURFACES.warehouse;
  const floor = { ...baseSceneObjects[0], color: surfaces.floor, materialKind: "diffuse", roughness: 0.86 };
  const wall = { ...baseSceneObjects[1], color: surfaces.wall, materialKind: "diffuse", roughness: 0.9 };
  const markers = options.showSources
    ? lightingOptions.lightSources
        .slice(0, 3)
        .map((source, index) => sourceMarker(source, index, options.motionPhase))
    : [];
  return [floor, wall, ...markers];
}

async function readProbeSummary(renderer, width, height, enabled = false) {
  if (!enabled) {
    return {
      readback: "disabled",
      probes: [],
      sampledPixels: 0,
      nonZeroSamples: 0,
      minLuminance: 0,
      maxLuminance: 0,
      averageLuminance: 0,
    };
  }
  const samples = [
    [Math.floor(width * 0.5), Math.floor(height * 0.5)],
    [Math.floor(width * 0.5), Math.floor(height * 0.34)],
    [Math.floor(width * 0.5), Math.floor(height * 0.68)],
    [Math.floor(width * 0.27), Math.floor(height * 0.5)],
    [Math.floor(width * 0.73), Math.floor(height * 0.5)],
  ];
  const probes = [];
  for (const [x, y] of samples) {
    probes.push(await renderer.readOutputProbe({ x, y }));
  }
  const luminances = probes.map((probe) => probe.luminance);
  return {
    readback: "enabled",
    probes,
    sampledPixels: probes.length,
    nonZeroSamples: probes.filter((probe) => Math.max(...probe.rgba.slice(0, 3)) > 0).length,
    minLuminance: Math.min(...luminances),
    maxLuminance: Math.max(...luminances),
    averageLuminance: luminances.reduce((total, value) => total + value, 0) / luminances.length,
  };
}

function summarizeCenterProbe(probeSummary) {
  if (probeSummary.readback !== "enabled" || probeSummary.probes.length <= 0) {
    return null;
  }
  const probe = probeSummary.probes[0];
  const maxChannel = Math.max(...probe.rgba.slice(0, 3));
  return {
    ...probe,
    sampledPixels: 1,
    nonZeroSamples: maxChannel > 0 ? 1 : 0,
    maxChannel,
  };
}

function updateHud(hud, result) {
  const sourceLabels = result.lightSources.map((source) => `${source.kind}/${source.role}`).join(", ");
  const workerJobs = result.renderer.gpuWorkerJobs;
  const renderedSamplesPerPixel = Number(
    result.renderer.renderedSamplesPerPixel ?? result.samplesPerPixel
  );
  const targetSamplesPerPixel = Number(
    result.renderer.targetSamplesPerPixel ?? result.samplesPerPixel
  );
  const requestedSamplesPerPixel = Number(result.samplesPerPixel);
  const sppLabel =
    renderedSamplesPerPixel === targetSamplesPerPixel &&
    targetSamplesPerPixel === requestedSamplesPerPixel
      ? `${requestedSamplesPerPixel} spp`
      : renderedSamplesPerPixel === targetSamplesPerPixel
        ? `${targetSamplesPerPixel}/${requestedSamplesPerPixel} spp`
        : targetSamplesPerPixel === requestedSamplesPerPixel
          ? `${renderedSamplesPerPixel}/${requestedSamplesPerPixel} spp`
          : `${renderedSamplesPerPixel}/${targetSamplesPerPixel}/${requestedSamplesPerPixel} spp`;
  const jobsPerSecond =
    typeof workerJobs.completedPerSecond === "number"
      ? `${workerJobs.completedPerSecond.toFixed(1)} jobs/s`
      : "jobs/s pending GPU completion";
  const budgetLabel =
    Number.isFinite(result.renderer.frameTimeBudgetMs) && result.renderer.frameTimeBudgetMs > 0
      ? `, ${result.renderer.frameTimeBudgetMs} ms budget${result.renderer.budgetConstrained ? ", adaptive" : ""}`
      : "";
  const governor = result.renderer.adaptiveSampling;
  const governorLabel = governor?.enabled
    ? `${governor.currentLevelId}, ${governor.pressureLevel} pressure`
    : "governor off";
  hud.innerHTML = `
    <strong>${result.preset}</strong>
    <span>${result.scene} - ${result.timeOfDay} - ${result.geometry}</span>
    <span>${sourceLabels}</span>
    <span>${result.width}x${result.height}, ${sppLabel}${budgetLabel}, denoise ${result.denoise ? "on" : "off"}, deferred ${result.deferredPathResolve ? "on" : "off"}</span>
    <span>${result.triangleCount.toLocaleString()} triangles, ${result.sceneObjectCount} analytic surfaces</span>
    <span>${governorLabel}</span>
    <span>${workerJobs.completedPerFrame.toLocaleString()} GPU jobs/frame, ${jobsPerSecond}, ${workerJobs.completedPerSubmission.toFixed(2)} jobs/submission</span>
    <span>${result.renderer.gpuParallelism.exposesMultiWorkgroupParallelism ? "multi-workgroup GPU dispatch" : "single-workgroup GPU dispatch"}</span>
  `;
}

function fail(error) {
  const captureState = globalThis.__plasiusCaptureState ?? null;
  if (globalThis.__plasiusCaptureBootTimeoutId) {
    clearTimeout(globalThis.__plasiusCaptureBootTimeoutId);
    delete globalThis.__plasiusCaptureBootTimeoutId;
  }
  window.__plasiusCaptureError = normalizeCaptureError(error, captureState, globalThis);
  window.__plasiusCaptureReady = true;
  const node = document.createElement("pre");
  node.className = "error";
  node.textContent = [
    window.__plasiusCaptureError.message,
    captureState?.step ? `step: ${captureState.step}` : null,
    captureState?.detail ? `detail: ${captureState.detail}` : null,
    `webgpu.hasGpu: ${window.__plasiusCaptureError.webgpu.hasGpu}`,
    `secureContext: ${window.__plasiusCaptureError.webgpu.secureContext}`,
  ]
    .filter(Boolean)
    .join("\n");
  document.body.appendChild(node);
}

export async function renderEamesEnvironment(options = {}) {
  const preset = options.preset ?? "grass-field-midday";
  const geometry = options.geometry ?? "mesh";
  const width = Number(options.width ?? 1280);
  const height = Number(options.height ?? 720);
  const frames = Number(options.frames ?? 2);
  const maxDepth = Number(options.maxDepth ?? 3);
  const samplesPerPixel = Number(options.samplesPerPixel ?? 8);
  const denoise = options.denoise !== false;
  const deferredPathResolve = options.deferredPathResolve !== false;
  const showSources = options.showSources === true;
  const motion = options.motion !== false;
  const readOutputProbe = options.readOutputProbe === true;
  const awaitGPUCompletion = options.awaitGPUCompletion !== false;
  const frameTimeBudgetMs = Number.isFinite(options.frameTimeBudgetMs)
    ? Math.max(0, Number(options.frameTimeBudgetMs))
    : motion && frames > 1
      ? 16
      : 0;
  const pathDebugLayer = Number.isInteger(options.pathDebugLayer) && options.pathDebugLayer >= 0
    ? options.pathDebugLayer
    : -1;
  const cameraPreset = String(options.cameraPreset ?? "reference");
  const frameIndex = Number.isInteger(options.frameIndex) ? options.frameIndex : 0;
  const canvas = options.canvas;
  if (!canvas) {
    throw new Error("renderEamesEnvironment requires a canvas.");
  }
  if (geometry !== "mesh") {
    throw new Error("Eames environment validation requires geometry=mesh so captures render source triangles, not proxy AABB boxes.");
  }
  canvas.width = width;
  canvas.height = height;

  const captureState = options.captureState ?? globalThis.__plasiusCaptureState ?? createCaptureState(globalThis);
  const hud = options.hud ?? null;

  setCaptureStep(captureState, "Loading runtime modules", "Importing renderer, lighting, and model helpers.", hud);
  const runtimeModules = options.runtimeModules ?? await loadCaptureRuntimeModules();
  const lightingOptions = runtimeModules.createWavefrontEnvironmentLightingOptions({ preset });
  setCaptureStep(captureState, "Loading Eames model", MODEL_URL, hud);
  const model = options.model ?? await runtimeModules.loadEamesGltfModel(MODEL_URL);
  setCaptureStep(captureState, "Preparing scene", "Building analytic surfaces and mesh triangles.", hud);
  const sceneObjects = buildEnvironmentSceneObjects(
    model,
    lightingOptions,
    { showSources },
    runtimeModules
  );
  const meshes = buildEamesMeshes(model);
  const adaptiveSampling = createAdaptiveSamplingController({
    samplesPerPixel,
    frameTimeBudgetMs,
    minimumSamplesPerPixel: 1,
    motion,
    createWavefrontAdaptiveSamplingLevels:
      runtimeModules.createWavefrontAdaptiveSamplingLevels,
    performanceModule: runtimeModules,
  });

  setCaptureStep(captureState, "Creating renderer", "Requesting WebGPU renderer and scene buffers.", hud);
  const renderer = await runtimeModules.createWavefrontPathTracingComputeRenderer({
    canvas,
    width,
    height,
    maxDepth,
    samplesPerPixel,
    tileSize: 128,
    sceneObjects,
    meshes,
    displayQuality: true,
    denoise,
    environmentColor: lightingOptions.environmentColor,
    ambientColor: lightingOptions.ambientColor,
    environmentLighting: lightingOptions.environmentLighting,
    environmentPortals: lightingOptions.environmentPortals,
    environmentPortalMode: lightingOptions.environmentPortalMode,
    deferredPathResolve,
    camera: createEnvironmentCamera(cameraPreset, frames <= 1 ? 0 : 0),
    frameIndex,
  });

  let stats = null;
  for (let frame = 0; frame < frames; frame += 1) {
    setCaptureStep(captureState, "Rendering frames", `Rendering frame ${frame + 1} of ${frames}.`, hud);
    const motionPhase = frames <= 1 ? 0 : frame / (frames - 1);
    if (typeof renderer.updateCamera === "function") {
      renderer.updateCamera(
        createEnvironmentCamera(cameraPreset, motion ? motionPhase : 0)
      );
    }
    if (motion && showSources) {
      const animatedSceneObjects = buildEnvironmentSceneObjects(model, lightingOptions, {
        showSources,
        motionPhase,
      }, runtimeModules);
      renderer.updateSceneObjects(animatedSceneObjects);
    }
    const frameOptions = adaptiveSampling.getFrameOptions();
    stats = await renderer.renderFrame({
      samplesPerPixel: frameOptions.samplesPerPixel,
      readOutputProbe: false,
      pathDebugLayer,
      awaitGPUCompletion,
      frameTimeBudgetMs: frameOptions.frameTimeBudgetMs,
      minimumSamplesPerPixel: frameOptions.minimumSamplesPerPixel,
    });
    adaptiveSampling.recordFrame(stats);
  }
  setCaptureStep(captureState, "Reading probes", "Collecting output probe diagnostics.", hud);
  const probeSummary = await readProbeSummary(renderer, width, height, readOutputProbe);
  const outputProbe = summarizeCenterProbe(probeSummary);
  const adaptiveSamplingSnapshot = adaptiveSampling.getSnapshot();
  const lightingEnvironment = lightingOptions.lightingEnvironment;
  const result = {
    status: "ok",
    preset,
    scene: lightingEnvironment.scene,
    timeOfDay: lightingEnvironment.timeOfDay,
    geometry,
    width,
    height,
    frames,
    maxDepth,
    samplesPerPixel,
    denoise,
    deferredPathResolve,
    pathDebugLayer,
    motion,
    cameraPreset,
    probeReadback: readOutputProbe,
    modelName: model.name,
    primitiveCount: model.primitives.length,
    triangleCount: Math.floor(model.indices.length / 3),
    sceneObjectCount: sceneObjects.length,
    meshCount: meshes.length,
    lightSources: lightingOptions.lightSources.map((source) => ({
      id: source.id,
      kind: source.kind,
      role: source.role,
      luminance: source.luminance,
    })),
    dominantLightSource: lightingOptions.dominantLightSource,
    environmentMissLighting: lightingOptions.environmentMissLighting,
    renderer: {
      frame: stats.frame,
      triangleCount: stats.triangleCount,
      emissiveTriangleCount: stats.emissiveTriangleCount,
      bvhNodeCount: stats.bvhNodeCount,
      accelerationBuildMode: stats.accelerationBuildMode,
      accelerationBuildSubmitted: stats.accelerationBuildSubmitted,
      deferredPathResolve: stats.deferredPathResolve,
      requestedSamplesPerPixel: samplesPerPixel,
      targetSamplesPerPixel: stats.samplesPerPixel ?? adaptiveSamplingSnapshot.targetSamplesPerPixel,
      renderedSamplesPerPixel: stats.renderedSamplesPerPixel,
      frameTimeBudgetMs: stats.frameTimeBudgetMs,
      budgetConstrained: stats.budgetConstrained,
      adaptiveSampling: adaptiveSamplingSnapshot,
      cameraPreset,
      gpuWorkerJobs: stats.gpuWorkerJobs,
      gpuParallelism: stats.gpuParallelism,
      outputProbe,
    },
    probeSummary,
  };
  return { model, renderer, result };
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get("preset") ?? "grass-field-midday";
  const geometry = params.get("geometry") ?? "mesh";
  const width = readNumberParam(params, "width", 1280, 320, 4096);
  const height = readNumberParam(params, "height", 720, 180, 2304);
  const frames = readNumberParam(params, "frames", 4, 1, 8);
  const maxDepth = readNumberParam(params, "maxDepth", 3, 1, 12);
  const samplesPerPixel = readNumberParam(params, "samplesPerPixel", 8, 1, 256);
  const denoise = params.get("denoise") !== "0";
  const deferredPathResolve = params.get("deferredPathResolve") !== "0";
  const showSources = params.get("showSources") === "1";
  const motion = params.get("motion") !== "0";
  const cameraPreset = params.get("cameraPreset") ?? "reference";
  const readOutputProbe = params.get("probe") === "1" || params.get("readOutputProbe") === "1";
  const pathDebugLayer = readNumberParam(params, "pathDebugLayer", -1, -1, 32);
  const captureUploadPath = params.get("captureUploadPath");
  const captureUploadUrl = params.get("captureUploadUrl");
  const captureBitmap = params.get("captureBitmap") === "1" || Boolean(captureUploadPath);
  const captureBitmapDelayMs = readNumberParam(params, "captureBitmapDelayMs", 8000, 0, 60000);
  const awaitGPUCompletion = params.get("awaitGPUCompletion") !== "0";
  const frameTimeBudgetMs = readNumberParam(params, "frameTimeBudgetMs", 0, 0, 1000);
  const frameIndex = readNumberParam(params, "frameIndex", 0, 0, 1_000_000);
  const bootTimeoutMs = computeCaptureBootTimeoutMs({
    width,
    height,
    frames,
    maxDepth,
    samplesPerPixel,
  });
  const canvas = document.getElementById("stage");
  const hud = document.getElementById("hud");
  const captureState = createCaptureState(globalThis);
  globalThis.__plasiusCaptureState = captureState;
  setCaptureStep(captureState, "Booting validation page", "Preparing runtime imports and browser diagnostics.", hud);
  const bootTimeout = setTimeout(() => {
    fail(
      new Error(
        `Timed out waiting for validation page readiness after ${bootTimeoutMs}ms.`
      )
    );
  }, bootTimeoutMs);
  globalThis.__plasiusCaptureBootTimeoutId = bootTimeout;
  const { renderer, result } = await renderEamesEnvironment({
    canvas,
    hud,
    preset,
    geometry,
    width,
    height,
    frames,
    maxDepth,
    samplesPerPixel,
    denoise,
    deferredPathResolve,
    showSources,
    motion,
    cameraPreset,
    readOutputProbe,
    pathDebugLayer,
    awaitGPUCompletion,
    frameTimeBudgetMs,
    frameIndex,
    captureState,
  });
  clearTimeout(bootTimeout);
  delete globalThis.__plasiusCaptureBootTimeoutId;
  if (captureBitmap) {
    await delayMilliseconds(captureBitmapDelayMs);
    window.__plasiusCaptureImage = freezeCanvasForCapture(canvas);
    if (captureUploadPath) {
      if (!window.__plasiusCaptureImage) {
        throw new Error("Capture upload requested but the validation canvas could not be frozen.");
      }
      setCaptureStep(captureState, "Uploading capture", "Saving the frozen validation frame.", hud);
      window.__plasiusCaptureUpload = await uploadCaptureArtifact(
        captureUploadPath,
        window.__plasiusCaptureImage,
        result,
        { uploadUrl: captureUploadUrl, runtime: globalThis }
      );
    }
  }
  window.__plasiusRenderer = renderer;
  window.__plasiusCaptureResult = result;
  window.__plasiusCaptureReady = true;
  setCaptureStep(captureState, "Render complete", "Validation frame finished successfully.", hud);
  updateHud(hud, result);
}

if (!globalThis.__PLASIUS_EAMES_ENVIRONMENT_MODULE_ONLY__) {
  globalThis.addEventListener?.("error", (event) => {
    if (globalThis.__plasiusCaptureReady === true) {
      return;
    }
    fail(event.error ?? new Error(event.message ?? "Unhandled page error."));
  });
  globalThis.addEventListener?.("unhandledrejection", (event) => {
    if (globalThis.__plasiusCaptureReady === true) {
      return;
    }
    fail(event.reason ?? new Error("Unhandled promise rejection."));
  });
  main().catch(fail);
}
