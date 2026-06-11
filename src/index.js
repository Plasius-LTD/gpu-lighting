function createModuleBaseUrl(metaUrl) {
  return Reflect.construct(URL, [String(metaUrl)]);
}

const baseUrl = (() => {
  if (typeof __IMPORT_META_URL__ !== "undefined") {
    return createModuleBaseUrl(__IMPORT_META_URL__);
  }
  if (typeof __filename !== "undefined" && typeof require !== "undefined") {
    const { pathToFileURL } = require("node:url");
    return pathToFileURL(__filename);
  }
  const base =
    typeof process !== "undefined" && process.cwd
      ? `file://${process.cwd()}/`
      : "file:///";
  return new URL("./index.js", base);
})();

const techniqueSpecs = {
  hybrid: {
    description:
      "Lumen-inspired hybrid realtime GI and reflections with radiance cache final gather.",
    prelude: "prelude.wgsl",
    jobs: {
      directLighting: "direct-lighting.job.wgsl",
      screenTrace: "screen-trace.job.wgsl",
      radianceCache: "radiance-cache.job.wgsl",
      finalGather: "final-gather.job.wgsl",
      reflectionResolve: "reflection-resolve.job.wgsl",
    },
  },
  pathtracer: {
    description:
      "Monte Carlo path-traced reference mode with progressive accumulation and denoise stage.",
    prelude: "prelude.wgsl",
    jobs: {
      pathTrace: "pathtrace.job.wgsl",
      accumulate: "accumulate.job.wgsl",
      denoise: "denoise.job.wgsl",
    },
  },
  volumetrics: {
    description:
      "Froxel volumetric lighting for fog, shafts, and participating media shadows.",
    prelude: "prelude.wgsl",
    jobs: {
      froxelIntegrate: "froxel-integrate.job.wgsl",
      volumetricShadow: "volumetric-shadow.job.wgsl",
    },
  },
  hdri: {
    description:
      "HDRI and IBL precompute passes including irradiance, specular prefilter, and BRDF LUT.",
    prelude: "prelude.wgsl",
    jobs: {
      irradianceConvolution: "irradiance-convolution.job.wgsl",
      specularPrefilter: "specular-prefilter.job.wgsl",
      brdfLut: "brdf-lut.job.wgsl",
    },
  },
};

function buildTechnique(name, spec) {
  const preludeUrl = new URL(`./techniques/${name}/${spec.prelude}`, baseUrl);
  const jobs = Object.entries(spec.jobs).map(([key, file]) => {
    const label = `lighting.${name}.${key}`;
    return {
      key,
      label,
      url: new URL(`./techniques/${name}/${file}`, baseUrl),
      sourceName: label,
    };
  });
  return {
    name,
    description: spec.description,
    preludeUrl,
    jobs,
  };
}

export const lightingTechniques = Object.freeze(
  Object.fromEntries(
    Object.entries(techniqueSpecs).map(([name, spec]) => [
      name,
      buildTechnique(name, spec),
    ])
  )
);

export const lightingTechniqueNames = Object.freeze(Object.keys(lightingTechniques));

export const defaultLightingTechnique = "hybrid";

const profileSpecs = {
  realtime: {
    description:
      "Primary runtime profile: hybrid GI/reflections with volumetrics and HDRI/IBL.",
    techniques: ["hybrid", "volumetrics", "hdri"],
  },
  hybrid: {
    description:
      "Hybrid-focused profile for direct tuning of Lumen-inspired realtime passes.",
    techniques: ["hybrid", "hdri"],
  },
  reference: {
    description:
      "Reference quality profile: path tracing plus volumetrics and HDRI/IBL validation.",
    techniques: ["pathtracer", "volumetrics", "hdri"],
  },
};

function buildProfile(name, spec) {
  return {
    name,
    description: spec.description,
    techniques: [...spec.techniques],
  };
}

export const lightingProfiles = Object.freeze(
  Object.fromEntries(
    Object.entries(profileSpecs).map(([name, spec]) => [
      name,
      buildProfile(name, spec),
    ])
  )
);

export const lightingProfileNames = Object.freeze(Object.keys(lightingProfiles));

export const defaultLightingProfile = "realtime";
export const lightingProfileModeOrder = Object.freeze([
  "realtime",
  "hybrid",
  "reference",
]);
export const lightingEnvironmentTimeOfDayNames = Object.freeze([
  "dawn",
  "midday",
  "dusk",
  "night",
]);
export const lightingEnvironmentSceneNames = Object.freeze([
  "studio",
  "harbor",
  "grass-field",
  "forest",
  "warehouse",
  "cavern",
]);
export const lightingEnvironmentLightSourceKinds = Object.freeze([
  "sky",
  "sun",
  "moon",
  "stars",
  "horizon-glow",
  "ground-bounce",
  "studio-softbox",
  "canopy-transmission",
  "window-portal",
  "fluorescent-strip",
  "sodium-door",
  "emergency-beacon",
  "cave-mouth",
  "torch",
  "bioluminescence",
  "lava-fissure",
  "crystal",
  "custom",
]);
export const lightingEnvironmentPortalShapes = Object.freeze(["rectangle"]);
export const lightingEnvironmentPortalModes = Object.freeze([
  "disabled",
  "guide",
  "guide-and-gate",
]);
export const defaultAdaptiveLightingProfilePolicy = Object.freeze({
  preferredProfile: "reference",
  minimumFrameRate: 30,
  sampleWindowSize: 4,
});
export const lightingDistanceBands = Object.freeze([
  "near",
  "mid",
  "far",
  "horizon",
]);

export const lightingWorkerQueueClass = "lighting";
export const lightingDebugOwner = "lighting";

const environmentPresetAmbientScales = Object.freeze({
  "grass-field": 0.78,
  forest: 0.78,
  warehouse: 0.82,
  cavern: 0.78,
});

const environmentSunlitBaselineByTimeOfDay = Object.freeze({
  dawn: 0.18,
  midday: 0.28,
  dusk: 0.14,
  night: 0.035,
});

const environmentSunlitBaselineSceneScales = Object.freeze({
  "grass-field": 1,
  forest: 0.78,
  warehouse: 0.62,
  cavern: 0.42,
  harbor: 0.85,
  studio: 0.58,
});

function freezeVec4(value) {
  return Object.freeze([value[0], value[1], value[2], value[3] ?? 1]);
}

function scaleVec4(value, scale) {
  return [
    value[0] * scale,
    value[1] * scale,
    value[2] * scale,
    value[3] ?? 1,
  ];
}

function normalizeVector3(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback];
  }
  const vector = [
    Number.isFinite(value[0]) ? value[0] : fallback[0],
    Number.isFinite(value[1]) ? value[1] : fallback[1],
    Number.isFinite(value[2]) ? value[2] : fallback[2],
  ];
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(length) || length <= 0.000001) {
    return [...fallback];
  }
  return vector.map((component) => component / length);
}

function readColor(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) {
    return freezeVec4(fallback);
  }
  return freezeVec4([
    Number.isFinite(value[0]) ? Math.max(0, value[0]) : fallback[0],
    Number.isFinite(value[1]) ? Math.max(0, value[1]) : fallback[1],
    Number.isFinite(value[2]) ? Math.max(0, value[2]) : fallback[2],
    Number.isFinite(value[3]) ? Math.max(0, Math.min(1, value[3])) : fallback[3] ?? 1,
  ]);
}

function colorLuminance(value) {
  return value[0] * 0.2126 + value[1] * 0.7152 + value[2] * 0.0722;
}

function readPositiveColor(value, fallback) {
  const color = readColor(value, fallback);
  const fallbackColor = readColor(fallback, [1, 1, 1, 1]);
  return freezeVec4([
    color[0] > 0 ? color[0] : Math.max(fallbackColor[0], 0.0001),
    color[1] > 0 ? color[1] : Math.max(fallbackColor[1], 0.0001),
    color[2] > 0 ? color[2] : Math.max(fallbackColor[2], 0.0001),
    color[3],
  ]);
}

function ensureNonNullColor(value, fallback = [1, 1, 1, 1]) {
  const color = readColor(value, fallback);
  if (colorLuminance(color) > 0.000001) {
    return color;
  }
  return readPositiveColor(fallback, [1, 1, 1, 1]);
}

function readFinite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function readVector3(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback];
  }
  return [
    Number.isFinite(value[0]) ? value[0] : fallback[0],
    Number.isFinite(value[1]) ? value[1] : fallback[1],
    Number.isFinite(value[2]) ? value[2] : fallback[2],
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalizeRawVector3(value, fallback) {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length <= 0.000001) {
    return [...fallback];
  }
  return value.map((component) => component / length);
}

function orthogonalFallback(normal) {
  if (Math.abs(normal[1]) < 0.92) {
    return normalizeRawVector3(cross3([0, 1, 0], normal), [1, 0, 0]);
  }
  return normalizeRawVector3(cross3([1, 0, 0], normal), [0, 0, 1]);
}

function normalizePortalTangent(value, normal) {
  const raw = normalizeVector3(value, orthogonalFallback(normal));
  const projected = [
    raw[0] - normal[0] * dot3(raw, normal),
    raw[1] - normal[1] * dot3(raw, normal),
    raw[2] - normal[2] * dot3(raw, normal),
  ];
  return normalizeRawVector3(projected, orthogonalFallback(normal));
}

function readPositiveFinite(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(number, 0.0001);
}

function normalizeEnvironmentPortalMode(value, hasPortals) {
  if (value == null) {
    return hasPortals ? "guide-and-gate" : "disabled";
  }
  if (value === "gate") {
    return "guide-and-gate";
  }
  if (lightingEnvironmentPortalModes.includes(value)) {
    return value;
  }
  throw new Error(
    `environmentPortalMode must be one of: ${lightingEnvironmentPortalModes.join(", ")}.`
  );
}

function normalizeEnvironmentPortal(portal, index) {
  if (!portal || typeof portal !== "object") {
    throw new Error(`environmentPortals[${index}] must be an object.`);
  }
  const shape = portal.shape ?? portal.kind ?? "rectangle";
  if (!lightingEnvironmentPortalShapes.includes(shape)) {
    throw new Error(
      `environmentPortals[${index}].shape must be one of: ${lightingEnvironmentPortalShapes.join(", ")}.`
    );
  }
  const normal = Object.freeze(
    normalizeVector3(portal.normal, [0, 0, 1])
  );
  const tangent = Object.freeze(normalizePortalTangent(portal.tangent, normal));
  const bitangent = Object.freeze(
    normalizeRawVector3(cross3(normal, tangent), [0, 1, 0])
  );
  const width = readPositiveFinite(
    portal.width,
    readPositiveFinite(portal.halfWidth, 0.5) * 2
  );
  const height = readPositiveFinite(
    portal.height,
    readPositiveFinite(portal.halfHeight, 0.5) * 2
  );
  const radianceScale = Math.max(
    0,
    readFinite(portal.radianceScale ?? portal.intensity, 1)
  );
  return Object.freeze({
    id: typeof portal.id === "string" && portal.id.length > 0
      ? portal.id
      : `environment-portal-${index}`,
    shape,
    position: Object.freeze(readVector3(portal.position ?? portal.center, [0, 0, 0])),
    normal,
    tangent,
    bitangent,
    width,
    height,
    radianceScale,
    color: readColor(portal.color, [1, 1, 1, 1]),
    twoSided: portal.twoSided !== false,
  });
}

function normalizeEnvironmentPortals(value) {
  if (value == null) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value)) {
    throw new Error("environmentPortals must be an array when provided.");
  }
  return Object.freeze(value.map(normalizeEnvironmentPortal));
}

function normalizeEnvironmentMap(value) {
  if (value == null) {
    return null;
  }
  if (!value || typeof value !== "object") {
    throw new Error("environmentMap must be an object when provided.");
  }
  return Object.freeze({
    ...value,
    id: typeof value.id === "string" && value.id.length > 0
      ? value.id
      : "environment-map",
    projection: typeof value.projection === "string" && value.projection.length > 0
      ? value.projection
      : "equirectangular",
    intensity: readPositiveFinite(value.intensity ?? value.radianceScale, 1),
    rotationRadians: readFinite(value.rotationRadians ?? value.rotation, 0),
    ambientStrength: Math.max(0, readFinite(value.ambientStrength, 0.32)),
  });
}

function freezeLightSourceSpec(source) {
  return Object.freeze({
    ...source,
    color: source.color ? freezeVec4(source.color) : undefined,
    direction: source.direction
      ? Object.freeze(normalizeVector3(source.direction, [0, 1, 0]))
      : undefined,
    position: source.position
      ? Object.freeze(readVector3(source.position, [0, 0, 0]))
      : undefined,
  });
}

function defineEnvironmentPreset(spec) {
  const scene = spec.scene ?? "studio";
  const timeOfDay = spec.timeOfDay ?? "midday";
  const ambientScale = Math.max(
    0,
    readFinite(spec.ambientScale, environmentPresetAmbientScales[scene] ?? 1)
  );
  const defaultSunlitBaseline =
    (environmentSunlitBaselineByTimeOfDay[timeOfDay] ??
      environmentSunlitBaselineByTimeOfDay.midday) *
    (environmentSunlitBaselineSceneScales[scene] ?? 0.58);
  const sunlitBaseline = Math.max(
    0,
    readFinite(spec.sunlitBaseline, defaultSunlitBaseline)
  );
  return Object.freeze({
    ...spec,
    scene,
    timeOfDay,
    horizonColor: freezeVec4(spec.horizonColor),
    zenithColor: freezeVec4(spec.zenithColor),
    sunDirection: Object.freeze(normalizeVector3(spec.sunDirection, [0, 1, 0])),
    sunColor: freezeVec4(spec.sunColor),
    ambientColor: freezeVec4(scaleVec4(spec.ambientColor, ambientScale)),
    sunlitBaseline,
    environmentLightSources: Object.freeze(
      (spec.environmentLightSources ?? []).map(freezeLightSourceSpec)
    ),
  });
}

function buildEnvironmentLightSourceFallback(config, preset) {
  const firstPresetSource = preset.environmentLightSources[0] ?? {};
  return {
    kind: firstPresetSource.kind ?? "sky",
    role: firstPresetSource.role ?? "fill",
    color: firstPresetSource.color ?? config.sunColor,
    intensity:
      firstPresetSource.intensity ??
      Math.max(config.environmentIntensity, 0.0001),
    direction: firstPresetSource.direction ?? config.sunDirection,
    angularRadiusRadians: firstPresetSource.angularRadiusRadians ?? 0.25,
    reach: firstPresetSource.reach ?? 1000,
  };
}

function normalizeEnvironmentLightSource(source, index, fallback) {
  if (!source || typeof source !== "object") {
    throw new Error(`environmentLightSources[${index}] must be an object.`);
  }
  const requestedKind = source.kind ?? source.type ?? fallback.kind ?? "custom";
  const kind = lightingEnvironmentLightSourceKinds.includes(requestedKind)
    ? requestedKind
    : "custom";
  const color = readPositiveColor(source.color, fallback.color ?? [1, 1, 1, 1]);
  const intensity = readPositiveFinite(
    source.intensity ?? source.radianceScale,
    fallback.intensity ?? 1
  );
  const radiance = freezeVec4([
    color[0] * intensity,
    color[1] * intensity,
    color[2] * intensity,
    color[3],
  ]);
  return Object.freeze({
    id:
      typeof source.id === "string" && source.id.length > 0
        ? source.id
        : `environment-light-source-${index}`,
    kind,
    type: kind,
    role:
      typeof source.role === "string" && source.role.length > 0
        ? source.role
        : fallback.role ?? "fill",
    direction: Object.freeze(
      normalizeVector3(source.direction, fallback.direction ?? [0, 1, 0])
    ),
    position: Object.freeze(
      readVector3(source.position ?? source.origin, fallback.position ?? [0, 0, 0])
    ),
    color,
    intensity,
    radiance,
    luminance: colorLuminance(radiance),
    angularRadiusRadians: readPositiveFinite(
      source.angularRadiusRadians ?? source.angularRadius,
      fallback.angularRadiusRadians ?? 0.25
    ),
    reach: readPositiveFinite(
      source.reach ?? source.distance,
      fallback.reach ?? 1000
    ),
    castsShadows: source.castsShadows !== false,
    contributesToEnvironment: source.contributesToEnvironment !== false,
  });
}

function normalizeEnvironmentLightSources(value, preset, config) {
  const baseSources = value ?? preset.environmentLightSources;
  const fallback = buildEnvironmentLightSourceFallback(config, preset);
  if (!Array.isArray(baseSources)) {
    throw new Error("environmentLightSources must be an array when provided.");
  }
  const normalizedSources = baseSources.length > 0
    ? baseSources.map((source, index) =>
        normalizeEnvironmentLightSource(source, index, fallback)
      )
    : [normalizeEnvironmentLightSource(fallback, 0, fallback)];
  return Object.freeze(normalizedSources);
}

function findDominantEnvironmentLightSource(sources) {
  return sources.reduce((dominant, source) =>
    source.luminance > dominant.luminance ? source : dominant
  );
}

function createEnvironmentMissLighting(source, environmentColor) {
  const fallbackRadiance = readPositiveColor(environmentColor, source.radiance);
  const radiance = ensureNonNullColor(source.radiance, fallbackRadiance);
  const color = readPositiveColor(source.color, environmentColor);
  return Object.freeze({
    sourceId: source.id,
    kind: source.kind,
    role: source.role,
    contribution: "inferred-environment",
    startingPoint: "environment-miss",
    direction: source.direction,
    position: source.position,
    color,
    intensity: Math.max(source.intensity, 0.0001),
    radiance,
    luminance: Math.max(colorLuminance(radiance), 0.0001),
  });
}

const environmentLightingPresets = Object.freeze({
  "moonlit-harbor": defineEnvironmentPreset({
    preset: "moonlit-harbor",
    scene: "harbor",
    timeOfDay: "night",
    environmentMode: 0,
    environmentIntensity: 0.86,
    exposure: 1,
    horizonColor: freezeVec4([0.33, 0.43, 0.53, 1]),
    zenithColor: freezeVec4([0.035, 0.07, 0.14, 1]),
    sunDirection: Object.freeze(normalizeVector3([0.22, 0.88, 0.42], [0, 1, 0])),
    sunColor: freezeVec4([2.1, 2.25, 2.65, 1]),
    ambientColor: freezeVec4([0.018, 0.023, 0.03, 1]),
    environmentLightSources: [
      {
        id: "harbor-moon",
        kind: "moon",
        role: "key",
        direction: [0.22, 0.88, 0.42],
        color: [0.7, 0.76, 0.9, 1],
        intensity: 2.2,
        angularRadiusRadians: 0.018,
      },
      {
        id: "harbor-sky",
        kind: "sky",
        role: "fill",
        direction: [0, 1, 0],
        color: [0.22, 0.31, 0.48, 1],
        intensity: 0.35,
      },
    ],
  }),
  "product-studio": defineEnvironmentPreset({
    preset: "product-studio",
    scene: "studio",
    timeOfDay: "midday",
    environmentMode: 1,
    environmentIntensity: 1.05,
    exposure: 1,
    horizonColor: freezeVec4([0.52, 0.61, 0.65, 1]),
    zenithColor: freezeVec4([0.18, 0.22, 0.26, 1]),
    sunDirection: Object.freeze(normalizeVector3([0.18, 0.93, 0.24], [0, 1, 0])),
    sunColor: freezeVec4([3.8, 3.55, 2.85, 1]),
    ambientColor: freezeVec4([0.024, 0.027, 0.03, 1]),
    environmentLightSources: [
      {
        id: "studio-key-softbox",
        kind: "studio-softbox",
        role: "key",
        direction: [0.18, 0.93, 0.24],
        color: [1, 0.94, 0.82, 1],
        intensity: 4.1,
        angularRadiusRadians: 0.42,
      },
      {
        id: "studio-fill-panel",
        kind: "studio-softbox",
        role: "fill",
        direction: [-0.56, 0.62, -0.2],
        color: [0.75, 0.84, 1, 1],
        intensity: 1.3,
        angularRadiusRadians: 0.55,
      },
    ],
  }),
  "neutral-studio": defineEnvironmentPreset({
    preset: "neutral-studio",
    scene: "studio",
    timeOfDay: "midday",
    environmentMode: 2,
    environmentIntensity: 0.95,
    exposure: 1,
    horizonColor: freezeVec4([0.48, 0.53, 0.55, 1]),
    zenithColor: freezeVec4([0.24, 0.26, 0.29, 1]),
    sunDirection: Object.freeze(normalizeVector3([-0.24, 0.86, 0.36], [0, 1, 0])),
    sunColor: freezeVec4([2.4, 2.35, 2.2, 1]),
    ambientColor: freezeVec4([0.028, 0.029, 0.03, 1]),
    environmentLightSources: [
      {
        id: "neutral-studio-overhead",
        kind: "studio-softbox",
        role: "key",
        direction: [-0.24, 0.86, 0.36],
        color: [0.96, 0.97, 1, 1],
        intensity: 2.5,
        angularRadiusRadians: 0.5,
      },
      {
        id: "neutral-studio-wall-bounce",
        kind: "ground-bounce",
        role: "fill",
        direction: [0.2, 0.3, -0.9],
        color: [0.55, 0.58, 0.62, 1],
        intensity: 0.8,
      },
    ],
  }),
  "grass-field-dawn": defineEnvironmentPreset({
    preset: "grass-field-dawn",
    scene: "grass-field",
    timeOfDay: "dawn",
    environmentMode: 3,
    environmentIntensity: 0.92,
    exposure: 1.06,
    horizonColor: [0.92, 0.54, 0.32, 1],
    zenithColor: [0.16, 0.28, 0.5, 1],
    sunDirection: [0.64, 0.32, 0.18],
    sunColor: [5.6, 3.15, 1.55, 1],
    ambientColor: [0.034, 0.047, 0.032, 1],
    environmentLightSources: [
      { id: "field-dawn-sun", kind: "sun", role: "key", direction: [0.64, 0.32, 0.18], color: [1, 0.58, 0.28, 1], intensity: 5.6, angularRadiusRadians: 0.012 },
      { id: "field-dawn-sky", kind: "sky", role: "fill", direction: [0, 1, 0], color: [0.36, 0.52, 0.82, 1], intensity: 0.9 },
      { id: "field-dawn-grass-bounce", kind: "ground-bounce", role: "bounce", direction: [0, 0.25, 0.1], color: [0.22, 0.44, 0.12, 1], intensity: 0.45 },
    ],
  }),
  "grass-field-midday": defineEnvironmentPreset({
    preset: "grass-field-midday",
    scene: "grass-field",
    timeOfDay: "midday",
    environmentMode: 4,
    environmentIntensity: 1.18,
    exposure: 0.96,
    horizonColor: [0.58, 0.78, 0.96, 1],
    zenithColor: [0.1, 0.34, 0.82, 1],
    sunDirection: [0.18, 0.98, 0.08],
    sunColor: [9.8, 9.4, 8.55, 1],
    ambientColor: [0.048, 0.062, 0.04, 1],
    environmentLightSources: [
      { id: "field-midday-sun", kind: "sun", role: "key", direction: [0.18, 0.98, 0.08], color: [1, 0.96, 0.86, 1], intensity: 9.8, angularRadiusRadians: 0.0093 },
      { id: "field-midday-sky", kind: "sky", role: "fill", direction: [0, 1, 0], color: [0.48, 0.7, 1, 1], intensity: 1.8 },
      { id: "field-midday-ground", kind: "ground-bounce", role: "bounce", direction: [0, 0.35, -0.15], color: [0.28, 0.56, 0.16, 1], intensity: 0.65 },
    ],
  }),
  "grass-field-dusk": defineEnvironmentPreset({
    preset: "grass-field-dusk",
    scene: "grass-field",
    timeOfDay: "dusk",
    environmentMode: 5,
    environmentIntensity: 0.82,
    exposure: 1.12,
    horizonColor: [1.08, 0.42, 0.24, 1],
    zenithColor: [0.09, 0.1, 0.32, 1],
    sunDirection: [-0.76, 0.24, 0.22],
    sunColor: [4.8, 1.65, 0.72, 1],
    ambientColor: [0.026, 0.026, 0.034, 1],
    environmentLightSources: [
      { id: "field-dusk-sun", kind: "sun", role: "key", direction: [-0.76, 0.24, 0.22], color: [1, 0.34, 0.16, 1], intensity: 4.8, angularRadiusRadians: 0.014 },
      { id: "field-dusk-horizon", kind: "horizon-glow", role: "fill", direction: [-0.9, 0.08, 0.1], color: [0.92, 0.28, 0.16, 1], intensity: 1.2 },
      { id: "field-dusk-grass", kind: "ground-bounce", role: "bounce", direction: [0, 0.22, 0.2], color: [0.12, 0.28, 0.11, 1], intensity: 0.35 },
    ],
  }),
  "grass-field-night": defineEnvironmentPreset({
    preset: "grass-field-night",
    scene: "grass-field",
    timeOfDay: "night",
    environmentMode: 6,
    environmentIntensity: 0.48,
    exposure: 1.35,
    horizonColor: [0.08, 0.13, 0.2, 1],
    zenithColor: [0.018, 0.035, 0.09, 1],
    sunDirection: [-0.22, 0.86, -0.34],
    sunColor: [0.72, 0.82, 1.35, 1],
    ambientColor: [0.012, 0.017, 0.026, 1],
    environmentLightSources: [
      { id: "field-night-moon", kind: "moon", role: "key", direction: [-0.22, 0.86, -0.34], color: [0.52, 0.62, 1, 1], intensity: 1.25, angularRadiusRadians: 0.018 },
      { id: "field-night-stars", kind: "stars", role: "fill", direction: [0, 1, 0], color: [0.32, 0.38, 0.6, 1], intensity: 0.24 },
      { id: "field-night-horizon", kind: "horizon-glow", role: "rim", direction: [0.8, 0.08, -0.15], color: [0.08, 0.14, 0.26, 1], intensity: 0.28 },
    ],
  }),
  "forest-dawn": defineEnvironmentPreset({
    preset: "forest-dawn",
    scene: "forest",
    timeOfDay: "dawn",
    environmentMode: 7,
    environmentIntensity: 0.78,
    exposure: 1.14,
    horizonColor: [0.72, 0.48, 0.28, 1],
    zenithColor: [0.08, 0.18, 0.18, 1],
    sunDirection: [0.58, 0.42, -0.24],
    sunColor: [4.4, 2.65, 1.32, 1],
    ambientColor: [0.024, 0.04, 0.026, 1],
    environmentLightSources: [
      { id: "forest-dawn-sun-shaft", kind: "sun", role: "key", direction: [0.58, 0.42, -0.24], color: [1, 0.62, 0.32, 1], intensity: 4.4, angularRadiusRadians: 0.018 },
      { id: "forest-dawn-canopy", kind: "canopy-transmission", role: "filter", direction: [0.12, 0.78, 0.2], color: [0.34, 0.68, 0.24, 1], intensity: 0.86 },
      { id: "forest-dawn-sky-gap", kind: "sky", role: "fill", direction: [-0.18, 0.92, 0.12], color: [0.28, 0.46, 0.62, 1], intensity: 0.48 },
    ],
  }),
  "forest-midday": defineEnvironmentPreset({
    preset: "forest-midday",
    scene: "forest",
    timeOfDay: "midday",
    environmentMode: 8,
    environmentIntensity: 0.96,
    exposure: 1.02,
    horizonColor: [0.38, 0.62, 0.42, 1],
    zenithColor: [0.08, 0.28, 0.32, 1],
    sunDirection: [0.08, 0.96, -0.18],
    sunColor: [7.2, 6.9, 5.25, 1],
    ambientColor: [0.034, 0.055, 0.032, 1],
    environmentLightSources: [
      { id: "forest-midday-sun-gap", kind: "sun", role: "key", direction: [0.08, 0.96, -0.18], color: [1, 0.96, 0.74, 1], intensity: 7.2, angularRadiusRadians: 0.013 },
      { id: "forest-midday-leaves", kind: "canopy-transmission", role: "filter", direction: [0.32, 0.75, 0.12], color: [0.24, 0.72, 0.28, 1], intensity: 1.35 },
      { id: "forest-midday-floor", kind: "ground-bounce", role: "bounce", direction: [-0.1, 0.25, 0.18], color: [0.18, 0.35, 0.13, 1], intensity: 0.42 },
    ],
  }),
  "forest-dusk": defineEnvironmentPreset({
    preset: "forest-dusk",
    scene: "forest",
    timeOfDay: "dusk",
    environmentMode: 9,
    environmentIntensity: 0.68,
    exposure: 1.2,
    horizonColor: [0.72, 0.28, 0.2, 1],
    zenithColor: [0.04, 0.07, 0.18, 1],
    sunDirection: [-0.7, 0.28, -0.18],
    sunColor: [3.2, 1.18, 0.56, 1],
    ambientColor: [0.018, 0.026, 0.024, 1],
    environmentLightSources: [
      { id: "forest-dusk-horizon", kind: "horizon-glow", role: "key", direction: [-0.7, 0.18, -0.18], color: [1, 0.34, 0.2, 1], intensity: 2.2, angularRadiusRadians: 0.1 },
      { id: "forest-dusk-canopy", kind: "canopy-transmission", role: "filter", direction: [0.18, 0.7, 0.26], color: [0.18, 0.38, 0.2, 1], intensity: 0.52 },
      { id: "forest-dusk-sky-gap", kind: "sky", role: "fill", direction: [0, 1, 0], color: [0.12, 0.16, 0.34, 1], intensity: 0.42 },
    ],
  }),
  "forest-night": defineEnvironmentPreset({
    preset: "forest-night",
    scene: "forest",
    timeOfDay: "night",
    environmentMode: 10,
    environmentIntensity: 0.42,
    exposure: 1.42,
    horizonColor: [0.035, 0.08, 0.1, 1],
    zenithColor: [0.012, 0.025, 0.06, 1],
    sunDirection: [0.2, 0.82, -0.46],
    sunColor: [0.42, 0.56, 1.1, 1],
    ambientColor: [0.01, 0.016, 0.02, 1],
    environmentLightSources: [
      { id: "forest-night-moon-gap", kind: "moon", role: "key", direction: [0.2, 0.82, -0.46], color: [0.42, 0.56, 1, 1], intensity: 0.95, angularRadiusRadians: 0.025 },
      { id: "forest-night-canopy", kind: "canopy-transmission", role: "filter", direction: [-0.16, 0.66, 0.1], color: [0.08, 0.18, 0.12, 1], intensity: 0.28 },
      { id: "forest-night-stars", kind: "stars", role: "fill", direction: [0, 1, 0], color: [0.22, 0.28, 0.5, 1], intensity: 0.18 },
    ],
  }),
  "warehouse-dawn": defineEnvironmentPreset({
    preset: "warehouse-dawn",
    scene: "warehouse",
    timeOfDay: "dawn",
    environmentMode: 11,
    environmentIntensity: 0.74,
    exposure: 1.08,
    horizonColor: [0.58, 0.44, 0.34, 1],
    zenithColor: [0.16, 0.19, 0.24, 1],
    sunDirection: [0.82, 0.28, 0.18],
    sunColor: [2.8, 1.7, 0.92, 1],
    ambientColor: [0.028, 0.03, 0.032, 1],
    environmentLightSources: [
      { id: "warehouse-dawn-loading-door", kind: "window-portal", role: "key", direction: [0.82, 0.28, 0.18], color: [1, 0.62, 0.34, 1], intensity: 2.8, angularRadiusRadians: 0.22 },
      { id: "warehouse-dawn-fluorescent", kind: "fluorescent-strip", role: "fill", direction: [0, 1, 0], color: [0.78, 0.9, 1, 1], intensity: 1.1, angularRadiusRadians: 0.35 },
      { id: "warehouse-dawn-concrete-bounce", kind: "ground-bounce", role: "bounce", direction: [0, 0.28, -0.2], color: [0.34, 0.36, 0.38, 1], intensity: 0.42 },
    ],
  }),
  "warehouse-midday": defineEnvironmentPreset({
    preset: "warehouse-midday",
    scene: "warehouse",
    timeOfDay: "midday",
    environmentMode: 12,
    environmentIntensity: 0.92,
    exposure: 0.98,
    horizonColor: [0.64, 0.7, 0.74, 1],
    zenithColor: [0.28, 0.34, 0.42, 1],
    sunDirection: [0.35, 0.86, 0.16],
    sunColor: [4.2, 4, 3.45, 1],
    ambientColor: [0.034, 0.036, 0.038, 1],
    environmentLightSources: [
      { id: "warehouse-midday-skylights", kind: "window-portal", role: "key", direction: [0.35, 0.86, 0.16], color: [0.92, 0.96, 1, 1], intensity: 4.2, angularRadiusRadians: 0.18 },
      { id: "warehouse-midday-fluorescent", kind: "fluorescent-strip", role: "fill", direction: [-0.2, 0.92, 0.1], color: [0.78, 0.92, 1, 1], intensity: 1.6, angularRadiusRadians: 0.45 },
      { id: "warehouse-midday-door-spill", kind: "sodium-door", role: "rim", direction: [-0.82, 0.18, -0.12], color: [1, 0.58, 0.24, 1], intensity: 0.68 },
    ],
  }),
  "warehouse-dusk": defineEnvironmentPreset({
    preset: "warehouse-dusk",
    scene: "warehouse",
    timeOfDay: "dusk",
    environmentMode: 13,
    environmentIntensity: 0.7,
    exposure: 1.16,
    horizonColor: [0.7, 0.32, 0.24, 1],
    zenithColor: [0.08, 0.1, 0.18, 1],
    sunDirection: [-0.78, 0.18, 0.16],
    sunColor: [2.4, 0.94, 0.48, 1],
    ambientColor: [0.022, 0.024, 0.03, 1],
    environmentLightSources: [
      { id: "warehouse-dusk-door-glow", kind: "sodium-door", role: "key", direction: [-0.78, 0.18, 0.16], color: [1, 0.42, 0.2, 1], intensity: 2.4, angularRadiusRadians: 0.18 },
      { id: "warehouse-dusk-fluorescent", kind: "fluorescent-strip", role: "fill", direction: [0, 0.95, -0.08], color: [0.72, 0.88, 1, 1], intensity: 1.35, angularRadiusRadians: 0.4 },
      { id: "warehouse-dusk-emergency", kind: "emergency-beacon", role: "accent", direction: [0.2, 0.35, -0.8], color: [1, 0.08, 0.04, 1], intensity: 0.32 },
    ],
  }),
  "warehouse-night": defineEnvironmentPreset({
    preset: "warehouse-night",
    scene: "warehouse",
    timeOfDay: "night",
    environmentMode: 14,
    environmentIntensity: 0.58,
    exposure: 1.28,
    horizonColor: [0.06, 0.08, 0.12, 1],
    zenithColor: [0.02, 0.03, 0.055, 1],
    sunDirection: [0.1, 0.94, -0.12],
    sunColor: [1.2, 1.65, 2.25, 1],
    ambientColor: [0.014, 0.018, 0.024, 1],
    environmentLightSources: [
      { id: "warehouse-night-fluorescent", kind: "fluorescent-strip", role: "key", direction: [0.1, 0.94, -0.12], color: [0.68, 0.88, 1, 1], intensity: 2.25, angularRadiusRadians: 0.5 },
      { id: "warehouse-night-emergency", kind: "emergency-beacon", role: "accent", direction: [-0.4, 0.3, 0.7], color: [1, 0.05, 0.025, 1], intensity: 0.4 },
      { id: "warehouse-night-door-leak", kind: "window-portal", role: "rim", direction: [0.82, 0.08, -0.2], color: [0.12, 0.22, 0.42, 1], intensity: 0.34 },
    ],
  }),
  "cavern-dawn": defineEnvironmentPreset({
    preset: "cavern-dawn",
    scene: "cavern",
    timeOfDay: "dawn",
    environmentMode: 15,
    environmentIntensity: 0.62,
    exposure: 1.24,
    horizonColor: [0.5, 0.3, 0.2, 1],
    zenithColor: [0.04, 0.07, 0.09, 1],
    sunDirection: [0.72, 0.32, 0.26],
    sunColor: [2.1, 1.22, 0.64, 1],
    ambientColor: [0.018, 0.018, 0.016, 1],
    environmentLightSources: [
      { id: "cavern-dawn-mouth", kind: "cave-mouth", role: "key", direction: [0.72, 0.32, 0.26], color: [1, 0.58, 0.3, 1], intensity: 2.1, angularRadiusRadians: 0.24 },
      { id: "cavern-dawn-torch", kind: "torch", role: "emissive", direction: [-0.35, 0.28, -0.6], color: [1, 0.42, 0.16, 1], intensity: 1.35, reach: 18 },
      { id: "cavern-dawn-crystal", kind: "crystal", role: "accent", direction: [0.08, 0.22, 0.9], color: [0.22, 0.72, 1, 1], intensity: 0.28, reach: 10 },
    ],
  }),
  "cavern-midday": defineEnvironmentPreset({
    preset: "cavern-midday",
    scene: "cavern",
    timeOfDay: "midday",
    environmentMode: 16,
    environmentIntensity: 0.72,
    exposure: 1.16,
    horizonColor: [0.6, 0.56, 0.48, 1],
    zenithColor: [0.08, 0.12, 0.14, 1],
    sunDirection: [0.36, 0.82, 0.14],
    sunColor: [3.4, 3.05, 2.2, 1],
    ambientColor: [0.02, 0.022, 0.02, 1],
    environmentLightSources: [
      { id: "cavern-midday-mouth", kind: "cave-mouth", role: "key", direction: [0.36, 0.82, 0.14], color: [1, 0.9, 0.66, 1], intensity: 3.4, angularRadiusRadians: 0.18 },
      { id: "cavern-midday-biolume", kind: "bioluminescence", role: "fill", direction: [-0.25, 0.25, 0.7], color: [0.1, 0.82, 0.64, 1], intensity: 0.46, reach: 14 },
      { id: "cavern-midday-wet-rock", kind: "ground-bounce", role: "bounce", direction: [0.1, 0.2, -0.3], color: [0.18, 0.2, 0.18, 1], intensity: 0.22 },
    ],
  }),
  "cavern-dusk": defineEnvironmentPreset({
    preset: "cavern-dusk",
    scene: "cavern",
    timeOfDay: "dusk",
    environmentMode: 17,
    environmentIntensity: 0.56,
    exposure: 1.32,
    horizonColor: [0.46, 0.18, 0.14, 1],
    zenithColor: [0.035, 0.045, 0.08, 1],
    sunDirection: [-0.62, 0.22, 0.22],
    sunColor: [1.55, 0.56, 0.28, 1],
    ambientColor: [0.014, 0.014, 0.018, 1],
    environmentLightSources: [
      { id: "cavern-dusk-mouth", kind: "cave-mouth", role: "rim", direction: [-0.62, 0.22, 0.22], color: [1, 0.36, 0.18, 1], intensity: 1.55, angularRadiusRadians: 0.22 },
      { id: "cavern-dusk-torch", kind: "torch", role: "key", direction: [0.32, 0.34, -0.54], color: [1, 0.38, 0.12, 1], intensity: 1.85, reach: 20 },
      { id: "cavern-dusk-biolume", kind: "bioluminescence", role: "fill", direction: [-0.18, 0.18, 0.74], color: [0.08, 0.58, 0.72, 1], intensity: 0.34, reach: 12 },
    ],
  }),
  "cavern-night": defineEnvironmentPreset({
    preset: "cavern-night",
    scene: "cavern",
    timeOfDay: "night",
    environmentMode: 18,
    environmentIntensity: 0.5,
    exposure: 1.45,
    horizonColor: [0.025, 0.035, 0.06, 1],
    zenithColor: [0.008, 0.014, 0.03, 1],
    sunDirection: [0.18, 0.28, -0.68],
    sunColor: [1.9, 0.72, 0.24, 1],
    ambientColor: [0.01, 0.012, 0.018, 1],
    environmentLightSources: [
      { id: "cavern-night-torch", kind: "torch", role: "key", direction: [0.18, 0.28, -0.68], color: [1, 0.36, 0.12, 1], intensity: 1.9, reach: 18 },
      { id: "cavern-night-biolume", kind: "bioluminescence", role: "fill", direction: [-0.32, 0.16, 0.72], color: [0.06, 0.62, 0.76, 1], intensity: 0.52, reach: 16 },
      { id: "cavern-night-lava", kind: "lava-fissure", role: "emissive", direction: [0.42, 0.12, 0.28], color: [1, 0.18, 0.04, 1], intensity: 0.8, reach: 12 },
    ],
  }),
});

export const lightingEnvironmentPresetNames = Object.freeze(
  Object.keys(environmentLightingPresets)
);

function resolveEnvironmentPreset(name, timeOfDay) {
  const presetName = typeof name === "string" && name.length > 0 ? name : "product-studio";
  const preset = environmentLightingPresets[presetName];
  if (!preset) {
    if (lightingEnvironmentSceneNames.includes(presetName)) {
      if (
        timeOfDay != null &&
        !lightingEnvironmentTimeOfDayNames.includes(timeOfDay)
      ) {
        throw new Error(
          `timeOfDay must be one of: ${lightingEnvironmentTimeOfDayNames.join(", ")}.`
        );
      }
      const scenePresetName = `${presetName}-${timeOfDay ?? "midday"}`;
      const scenePreset = environmentLightingPresets[scenePresetName];
      if (scenePreset) {
        return scenePreset;
      }
    }
    throw new Error(
      `Unknown lighting environment preset "${presetName}". Expected one of: ${lightingEnvironmentPresetNames.join(", ")}.`
    );
  }
  return preset;
}

function estimateEnvironmentColor(config) {
  const horizonWeight = 0.58;
  const zenithWeight = 1 - horizonWeight;
  const glowWeight = 0.055;
  const intensity = Math.max(config.environmentIntensity, 0.0001);
  return ensureNonNullColor([
    (config.horizonColor[0] * horizonWeight + config.zenithColor[0] * zenithWeight + config.sunColor[0] * glowWeight) * intensity,
    (config.horizonColor[1] * horizonWeight + config.zenithColor[1] * zenithWeight + config.sunColor[1] * glowWeight) * intensity,
    (config.horizonColor[2] * horizonWeight + config.zenithColor[2] * zenithWeight + config.sunColor[2] * glowWeight) * intensity,
    1,
  ], config.dominantLightSource?.radiance ?? config.sunColor);
}

export function createEnvironmentLightingConfig(options = {}) {
  const preset = resolveEnvironmentPreset(
    options.preset ?? options.name ?? options.scene,
    options.timeOfDay
  );
  const environmentPortals = normalizeEnvironmentPortals(
    options.environmentPortals ?? options.portals
  );
  const environmentMap = normalizeEnvironmentMap(
    options.environmentMap ?? options.hdri ?? preset.environmentMap
  );
  const environmentPortalMode = normalizeEnvironmentPortalMode(
    options.environmentPortalMode ?? options.portalMode,
    environmentPortals.length > 0
  );
  const environmentIntensity = Math.max(
    readFinite(options.environmentIntensity ?? options.intensity, preset.environmentIntensity),
    0.0001
  );
  const baseConfig = {
    preset: preset.preset,
    scene: preset.scene,
    timeOfDay: preset.timeOfDay,
    profile: typeof options.profile === "string" ? options.profile : defaultLightingProfile,
    environmentMode: Math.max(0, Math.trunc(readFinite(options.environmentMode, preset.environmentMode))),
    environmentIntensity,
    exposure: Math.max(0.0001, readFinite(options.exposure, preset.exposure)),
    horizonColor: readColor(options.horizonColor, preset.horizonColor),
    zenithColor: readColor(options.zenithColor, preset.zenithColor),
    sunDirection: Object.freeze(
      normalizeVector3(options.sunDirection, preset.sunDirection)
    ),
    sunColor: readColor(options.sunColor, preset.sunColor),
    ambientColor: readColor(options.ambientColor, preset.ambientColor),
    sunlitBaseline: Math.max(
      0,
      readFinite(options.sunlitBaseline ?? options.daylightBaseline, preset.sunlitBaseline)
    ),
    environmentPortalMode,
    environmentPortals,
    environmentMap,
  };
  const environmentLightSources = normalizeEnvironmentLightSources(
    options.environmentLightSources ?? options.lightSources,
    preset,
    baseConfig
  );
  const dominantLightSource = findDominantEnvironmentLightSource(
    environmentLightSources
  );
  const config = {
    ...baseConfig,
    environmentLightSources,
    lightSources: environmentLightSources,
    dominantLightSource,
  };
  const environmentColor = estimateEnvironmentColor(config);
  const environmentMissLighting = createEnvironmentMissLighting(
    dominantLightSource,
    environmentColor
  );

  return Object.freeze({
    ...config,
    environmentColor,
    environmentMissLighting,
    wavefront: Object.freeze({
      environmentColor,
      ambientColor: config.ambientColor,
      sunlitBaseline: config.sunlitBaseline,
      environmentPortalMode: config.environmentPortalMode,
      environmentPortals: config.environmentPortals,
      environmentMap: config.environmentMap,
      environmentLightSources: config.environmentLightSources,
      lightSources: config.environmentLightSources,
      dominantLightSource,
      environmentMissLighting,
      environmentLighting: Object.freeze({
        horizonColor: config.horizonColor,
        zenithColor: config.zenithColor,
        sunDirection: Object.freeze([...config.sunDirection]),
        sunColor: config.sunColor,
        intensity: config.environmentIntensity,
        mode: config.environmentMode,
        exposure: config.exposure,
        sunlitBaseline: config.sunlitBaseline,
        environmentPortalMode: config.environmentPortalMode,
        environmentPortalCount: config.environmentPortals.length,
        environmentMap: config.environmentMap,
        environmentLightSources: config.environmentLightSources,
        environmentLightSourceCount: config.environmentLightSources.length,
        dominantLightSource,
        environmentMissLighting,
      }),
    }),
  });
}

export function createWavefrontEnvironmentLightingOptions(options = {}) {
  const config = createEnvironmentLightingConfig(options);
  return Object.freeze({
    environmentColor: config.wavefront.environmentColor,
    ambientColor: config.wavefront.ambientColor,
    sunlitBaseline: config.wavefront.sunlitBaseline,
    environmentPortalMode: config.wavefront.environmentPortalMode,
    environmentPortals: config.wavefront.environmentPortals,
    environmentMap: config.wavefront.environmentMap,
    environmentLightSources: config.wavefront.environmentLightSources,
    lightSources: config.wavefront.environmentLightSources,
    dominantLightSource: config.wavefront.dominantLightSource,
    environmentMissLighting: config.wavefront.environmentMissLighting,
    environmentLighting: config.wavefront.environmentLighting,
    lightingEnvironment: config,
  });
}

const lightingImportanceLevels = Object.freeze([
  "low",
  "medium",
  "high",
  "critical",
]);

const lightingBandPolicySpecs = Object.freeze({
  near: Object.freeze({
    primaryShadowSource: "ray-traced-primary",
    assistShadowSources: Object.freeze(["visibility-raster", "shadow-map-assist"]),
    temporalReuse: "balanced",
    updateCadenceDivisor: 1,
    liveObjectShadows: true,
    impressionOnly: false,
  }),
  mid: Object.freeze({
    primaryShadowSource: "selective-raster-and-proxy",
    assistShadowSources: Object.freeze([
      "regional-shadow-map",
      "proxy-caster",
      "temporal-history",
    ]),
    temporalReuse: "aggressive",
    updateCadenceDivisor: 2,
    liveObjectShadows: true,
    impressionOnly: false,
  }),
  far: Object.freeze({
    primaryShadowSource: "merged-proxy-casters",
    assistShadowSources: Object.freeze([
      "coarse-directional",
      "semi-static-occlusion",
    ]),
    temporalReuse: "high",
    updateCadenceDivisor: 8,
    liveObjectShadows: false,
    impressionOnly: false,
  }),
  horizon: Object.freeze({
    primaryShadowSource: "baked-impression",
    assistShadowSources: Object.freeze(["atmospheric-gradient", "skyline-darkening"]),
    temporalReuse: "baked",
    updateCadenceDivisor: 60,
    liveObjectShadows: false,
    impressionOnly: true,
  }),
});

function assertLightingImportance(name, value) {
  if (!lightingImportanceLevels.includes(value)) {
    throw new Error(
      `${name} must be one of: ${lightingImportanceLevels.join(", ")}.`
    );
  }
  return value;
}

function readPositiveIntegerOption(name, value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.round(value) !== value
  ) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function resolveBandParticipation(profileName, band, importance) {
  const referenceProfile = profileName === "reference";
  const premiumImportance =
    importance === "critical" || importance === "high";

  if (band === "near") {
    return Object.freeze({
      directShadows: premiumImportance ? "premium" : "selective",
      reflections: premiumImportance ? "premium" : "selective",
      globalIllumination:
        referenceProfile || importance === "critical" ? "premium" : "selective",
    });
  }

  if (band === "mid") {
    return Object.freeze({
      directShadows: premiumImportance ? "selective" : "proxy",
      reflections:
        referenceProfile && premiumImportance ? "selective" : "proxy",
      globalIllumination:
        referenceProfile && importance === "critical" ? "selective" : "disabled",
    });
  }

  if (band === "far") {
    return Object.freeze({
      directShadows: "proxy",
      reflections:
        referenceProfile && importance === "critical" ? "proxy" : "disabled",
      globalIllumination: "disabled",
    });
  }

  return Object.freeze({
    directShadows: "disabled",
    reflections: "disabled",
    globalIllumination: "disabled",
  });
}

export function createLightingBandPlan(options = {}) {
  const profileName = options.profile ?? defaultLightingProfile;
  const profile = getLightingProfile(profileName);
  const importance = assertLightingImportance(
    "importance",
    options.importance ?? "high"
  );

  const bands = Object.freeze(
    lightingDistanceBands.map((band) =>
      Object.freeze({
        band,
        profile: profile.name,
        importance,
        primaryShadowSource: lightingBandPolicySpecs[band].primaryShadowSource,
        assistShadowSources: Object.freeze([
          ...lightingBandPolicySpecs[band].assistShadowSources,
        ]),
        rtParticipation: resolveBandParticipation(profile.name, band, importance),
        temporalReuse: lightingBandPolicySpecs[band].temporalReuse,
        updateCadenceDivisor: lightingBandPolicySpecs[band].updateCadenceDivisor,
        liveObjectShadows: lightingBandPolicySpecs[band].liveObjectShadows,
        impressionOnly: lightingBandPolicySpecs[band].impressionOnly,
      })
    )
  );

  return Object.freeze({
    schemaVersion: 1,
    owner: lightingDebugOwner,
    profile: profile.name,
    importance,
    techniques: Object.freeze([...profile.techniques]),
    bands,
  });
}

const lightingProfileModeEstimatedCostMs = Object.freeze({
  realtime: 4.5,
  hybrid: 7.5,
  reference: 12.5,
});

export function createLightingProfileModeLadder(options = {}) {
  const moduleId =
    typeof options.id === "string" && options.id.trim().length > 0
      ? options.id.trim()
      : "lighting-profile-mode";
  const preferredProfile = getLightingProfile(
    options.preferredProfile ?? defaultAdaptiveLightingProfilePolicy.preferredProfile
  ).name;
  const initialProfile = getLightingProfile(
    options.initialProfile ?? preferredProfile
  ).name;
  const minimumFrameRate = readPositiveIntegerOption(
    "minimumFrameRate",
    options.minimumFrameRate,
    defaultAdaptiveLightingProfilePolicy.minimumFrameRate
  );
  const sampleWindowSize = readPositiveIntegerOption(
    "sampleWindowSize",
    options.sampleWindowSize,
    defaultAdaptiveLightingProfilePolicy.sampleWindowSize
  );
  const importance = assertLightingImportance(
    "importance",
    options.importance ?? "high"
  );
  const moduleImportance = assertLightingImportance(
    "moduleImportance",
    options.moduleImportance ?? "critical"
  );

  const levels = Object.freeze(
    lightingProfileModeOrder.map((profileName) => {
      const profile = getLightingProfile(profileName);
      return Object.freeze({
        id: profile.name,
        estimatedCostMs: lightingProfileModeEstimatedCostMs[profile.name],
        config: Object.freeze({
          profile: profile.name,
          description: profile.description,
          techniques: Object.freeze([...profile.techniques]),
          lightingBandPlan: createLightingBandPlan({
            profile: profile.name,
            importance,
          }),
          policy: Object.freeze({
            preferredProfile,
            minimumFrameRate,
            sampleWindowSize,
          }),
        }),
      });
    })
  );

  return Object.freeze({
    id: moduleId,
    domain: "lighting",
    authority: "visual",
    importance: moduleImportance,
    initialLevel: initialProfile,
    levels,
    target: Object.freeze({
      minimumFrameRate,
      maximumFrameRate: minimumFrameRate,
      preferredFrameRates: Object.freeze([minimumFrameRate]),
    }),
    adaptation: Object.freeze({
      sampleWindowSize,
      minimumSamplesBeforeAdjustment: sampleWindowSize,
      degradeCooldownFrames: 1,
      upgradeCooldownFrames: sampleWindowSize,
      minStableFramesForRecovery: sampleWindowSize,
    }),
    policy: Object.freeze({
      preferredProfile,
      minimumFrameRate,
      sampleWindowSize,
    }),
  });
}

function buildWorkerBudgetLevels(jobType, queueClass, presets) {
  return Object.freeze([
    Object.freeze({
      id: "low",
      estimatedCostMs: presets.low.estimatedCostMs,
      config: Object.freeze({
        maxDispatchesPerFrame: presets.low.maxDispatchesPerFrame,
        maxJobsPerDispatch: presets.low.maxJobsPerDispatch,
        cadenceDivisor: presets.low.cadenceDivisor,
        workgroupScale: presets.low.workgroupScale,
        maxQueueDepth: presets.low.maxQueueDepth,
        metadata: Object.freeze({
          owner: lightingDebugOwner,
          queueClass,
          jobType,
          quality: "low",
        }),
      }),
    }),
    Object.freeze({
      id: "medium",
      estimatedCostMs: presets.medium.estimatedCostMs,
      config: Object.freeze({
        maxDispatchesPerFrame: presets.medium.maxDispatchesPerFrame,
        maxJobsPerDispatch: presets.medium.maxJobsPerDispatch,
        cadenceDivisor: presets.medium.cadenceDivisor,
        workgroupScale: presets.medium.workgroupScale,
        maxQueueDepth: presets.medium.maxQueueDepth,
        metadata: Object.freeze({
          owner: lightingDebugOwner,
          queueClass,
          jobType,
          quality: "medium",
        }),
      }),
    }),
    Object.freeze({
      id: "high",
      estimatedCostMs: presets.high.estimatedCostMs,
      config: Object.freeze({
        maxDispatchesPerFrame: presets.high.maxDispatchesPerFrame,
        maxJobsPerDispatch: presets.high.maxJobsPerDispatch,
        cadenceDivisor: presets.high.cadenceDivisor,
        workgroupScale: presets.high.workgroupScale,
        maxQueueDepth: presets.high.maxQueueDepth,
        metadata: Object.freeze({
          owner: lightingDebugOwner,
          queueClass,
          jobType,
          quality: "high",
        }),
      }),
    }),
  ]);
}

const lightingWorkerSpecPresets = {
  hybrid: {
    suggestedAllocationIds: [
      "lighting.hybrid.radiance-cache",
      "lighting.hybrid.reflection-history",
      "lighting.hybrid.shadow-atlas",
    ],
    jobs: {
      directLighting: {
        domain: "lighting",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.hybrid.directLighting",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.5,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 128,
            },
            medium: {
              estimatedCostMs: 0.9,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 128,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 256,
            },
            high: {
              estimatedCostMs: 1.2,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 256,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 512,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hybrid.shadow-atlas"],
      },
      screenTrace: {
        domain: "reflections",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.hybrid.screenTrace",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.8,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 3,
              workgroupScale: 0.4,
              maxQueueDepth: 96,
            },
            medium: {
              estimatedCostMs: 1.5,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 96,
              cadenceDivisor: 2,
              workgroupScale: 0.7,
              maxQueueDepth: 192,
            },
            high: {
              estimatedCostMs: 2.2,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 192,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 384,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hybrid.reflection-history"],
      },
      radianceCache: {
        domain: "lighting",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.hybrid.radianceCache",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.7,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 96,
            },
            medium: {
              estimatedCostMs: 1.2,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 192,
            },
            high: {
              estimatedCostMs: 1.8,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 128,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 256,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hybrid.radiance-cache"],
      },
      finalGather: {
        domain: "lighting",
        importance: "critical",
        levels: buildWorkerBudgetLevels(
          "lighting.hybrid.finalGather",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 1,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 48,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 128,
            },
            medium: {
              estimatedCostMs: 1.8,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 96,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 256,
            },
            high: {
              estimatedCostMs: 2.6,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 192,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 384,
            },
          }
        ),
        suggestedAllocationIds: [
          "lighting.hybrid.radiance-cache",
          "lighting.hybrid.reflection-history",
        ],
      },
      reflectionResolve: {
        domain: "reflections",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.hybrid.reflectionResolve",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 96,
            },
            medium: {
              estimatedCostMs: 0.8,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 192,
            },
            high: {
              estimatedCostMs: 1.2,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 128,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 256,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hybrid.reflection-history"],
      },
    },
  },
  pathtracer: {
    suggestedAllocationIds: [
      "lighting.pathtracer.path-state",
      "lighting.pathtracer.accumulation",
      "lighting.pathtracer.denoise-history",
    ],
    jobs: {
      pathTrace: {
        domain: "lighting",
        importance: "critical",
        levels: buildWorkerBudgetLevels(
          "lighting.pathtracer.pathTrace",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 1.2,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 3,
              workgroupScale: 0.45,
              maxQueueDepth: 48,
            },
            medium: {
              estimatedCostMs: 2.3,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 2,
              workgroupScale: 0.7,
              maxQueueDepth: 96,
            },
            high: {
              estimatedCostMs: 3.8,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 128,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.pathtracer.path-state"],
      },
      accumulate: {
        domain: "lighting",
        importance: "medium",
        levels: buildWorkerBudgetLevels(
          "lighting.pathtracer.accumulate",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 32,
            },
            medium: {
              estimatedCostMs: 0.8,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 64,
            },
            high: {
              estimatedCostMs: 1.1,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 96,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.pathtracer.accumulation"],
      },
      denoise: {
        domain: "post-processing",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.pathtracer.denoise",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 32,
            },
            medium: {
              estimatedCostMs: 0.9,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 64,
            },
            high: {
              estimatedCostMs: 1.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 96,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.pathtracer.denoise-history"],
      },
    },
  },
  volumetrics: {
    suggestedAllocationIds: [
      "lighting.volumetrics.froxel-grid",
      "lighting.volumetrics.shadow-history",
    ],
    jobs: {
      froxelIntegrate: {
        domain: "volumetrics",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.volumetrics.froxelIntegrate",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.6,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 96,
            },
            medium: {
              estimatedCostMs: 1.1,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 64,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 192,
            },
            high: {
              estimatedCostMs: 1.7,
              maxDispatchesPerFrame: 2,
              maxJobsPerDispatch: 128,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 256,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.volumetrics.froxel-grid"],
      },
      volumetricShadow: {
        domain: "volumetrics",
        importance: "high",
        levels: buildWorkerBudgetLevels(
          "lighting.volumetrics.volumetricShadow",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.5,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 24,
              cadenceDivisor: 2,
              workgroupScale: 0.5,
              maxQueueDepth: 64,
            },
            medium: {
              estimatedCostMs: 0.9,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 48,
              cadenceDivisor: 1,
              workgroupScale: 0.75,
              maxQueueDepth: 128,
            },
            high: {
              estimatedCostMs: 1.3,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 96,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 192,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.volumetrics.shadow-history"],
      },
    },
  },
  hdri: {
    suggestedAllocationIds: [
      "lighting.hdri.cubemap",
      "lighting.hdri.prefilter",
      "lighting.hdri.brdf-lut",
    ],
    jobs: {
      irradianceConvolution: {
        domain: "lighting",
        importance: "medium",
        levels: buildWorkerBudgetLevels(
          "lighting.hdri.irradianceConvolution",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.3,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 8,
              cadenceDivisor: 3,
              workgroupScale: 0.5,
              maxQueueDepth: 16,
            },
            medium: {
              estimatedCostMs: 0.5,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 2,
              workgroupScale: 0.75,
              maxQueueDepth: 32,
            },
            high: {
              estimatedCostMs: 0.8,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 48,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hdri.cubemap"],
      },
      specularPrefilter: {
        domain: "lighting",
        importance: "medium",
        levels: buildWorkerBudgetLevels(
          "lighting.hdri.specularPrefilter",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 8,
              cadenceDivisor: 3,
              workgroupScale: 0.5,
              maxQueueDepth: 16,
            },
            medium: {
              estimatedCostMs: 0.7,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 2,
              workgroupScale: 0.75,
              maxQueueDepth: 32,
            },
            high: {
              estimatedCostMs: 1,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 32,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 48,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hdri.prefilter"],
      },
      brdfLut: {
        domain: "lighting",
        importance: "low",
        levels: buildWorkerBudgetLevels(
          "lighting.hdri.brdfLut",
          lightingWorkerQueueClass,
          {
            low: {
              estimatedCostMs: 0.2,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 4,
              cadenceDivisor: 3,
              workgroupScale: 0.5,
              maxQueueDepth: 8,
            },
            medium: {
              estimatedCostMs: 0.4,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 8,
              cadenceDivisor: 2,
              workgroupScale: 0.75,
              maxQueueDepth: 16,
            },
            high: {
              estimatedCostMs: 0.6,
              maxDispatchesPerFrame: 1,
              maxJobsPerDispatch: 16,
              cadenceDivisor: 1,
              workgroupScale: 1,
              maxQueueDepth: 24,
            },
          }
        ),
        suggestedAllocationIds: ["lighting.hdri.brdf-lut"],
      },
    },
  },
};

const lightingWorkerDagSpecs = {
  hybrid: {
    directLighting: { priority: 4, dependencies: [] },
    screenTrace: { priority: 3, dependencies: [] },
    radianceCache: { priority: 4, dependencies: ["directLighting"] },
    finalGather: { priority: 2, dependencies: ["radianceCache", "screenTrace"] },
    reflectionResolve: {
      priority: 1,
      dependencies: ["screenTrace", "finalGather"],
    },
  },
  pathtracer: {
    pathTrace: { priority: 4, dependencies: [] },
    accumulate: { priority: 3, dependencies: ["pathTrace"] },
    denoise: { priority: 2, dependencies: ["accumulate"] },
  },
  volumetrics: {
    volumetricShadow: { priority: 3, dependencies: [] },
    froxelIntegrate: { priority: 2, dependencies: ["volumetricShadow"] },
  },
  hdri: {
    irradianceConvolution: { priority: 3, dependencies: [] },
    specularPrefilter: { priority: 3, dependencies: [] },
    brdfLut: {
      priority: 2,
      dependencies: ["irradianceConvolution", "specularPrefilter"],
    },
  },
};

function resolveLightingQualityDimensions(techniqueName, jobKey) {
  const key = `${techniqueName}.${jobKey}`;
  return Object.freeze(
    {
      "hybrid.directLighting": { shadows: 1, lightingSamples: 0.7 },
      "hybrid.screenTrace": { rayTracing: 1, temporalReuse: 0.4 },
      "hybrid.radianceCache": {
        lightingSamples: 0.8,
        updateCadence: 0.7,
        temporalReuse: 1,
      },
      "hybrid.finalGather": { lightingSamples: 1, rayTracing: 0.6 },
      "hybrid.reflectionResolve": {
        rayTracing: 0.5,
        temporalReuse: 1,
        shading: 0.3,
      },
      "pathtracer.pathTrace": { rayTracing: 1, lightingSamples: 1 },
      "pathtracer.accumulate": { temporalReuse: 1, updateCadence: 0.4 },
      "pathtracer.denoise": { temporalReuse: 1, shading: 0.4 },
      "volumetrics.froxelIntegrate": {
        lightingSamples: 0.6,
        shading: 0.4,
        updateCadence: 0.3,
      },
      "volumetrics.volumetricShadow": { shadows: 0.8, updateCadence: 0.5 },
      "hdri.irradianceConvolution": {
        lightingSamples: 0.4,
        temporalReuse: 1,
        updateCadence: 1,
      },
      "hdri.specularPrefilter": {
        lightingSamples: 0.5,
        temporalReuse: 1,
        updateCadence: 1,
      },
      "hdri.brdfLut": {
        shading: 0.4,
        temporalReuse: 1,
        updateCadence: 1,
      },
    }[key] ?? {}
  );
}

function resolveLightingImportanceSignals(techniqueName, jobKey) {
  const key = `${techniqueName}.${jobKey}`;
  return Object.freeze(
    {
      "hybrid.directLighting": { visible: true, shadowSignificance: "high" },
      "hybrid.screenTrace": { visible: true, reflectionSignificance: "high" },
      "hybrid.radianceCache": { visible: true },
      "hybrid.finalGather": {
        visible: true,
        shadowSignificance: "critical",
        reflectionSignificance: "high",
      },
      "hybrid.reflectionResolve": { visible: true, reflectionSignificance: "high" },
      "pathtracer.pathTrace": {
        visible: true,
        shadowSignificance: "high",
        reflectionSignificance: "high",
      },
      "pathtracer.accumulate": { visible: true },
      "pathtracer.denoise": { visible: true },
      "volumetrics.froxelIntegrate": { visible: true },
      "volumetrics.volumetricShadow": { visible: true, shadowSignificance: "high" },
      "hdri.irradianceConvolution": { visible: false },
      "hdri.specularPrefilter": { visible: false, reflectionSignificance: "medium" },
      "hdri.brdfLut": { visible: false },
    }[key] ?? {}
  );
}

function buildWorkerManifestJob(techniqueName, job) {
  const spec = lightingWorkerSpecPresets[techniqueName].jobs[job.key];
  const dag = lightingWorkerDagSpecs[techniqueName][job.key];
  const dependencies = dag.dependencies.map(
    (dependency) => `lighting.${techniqueName}.${dependency}`
  );

  return Object.freeze({
    key: job.key,
    label: job.label,
    worker: Object.freeze({
      jobType: job.label,
      queueClass: lightingWorkerQueueClass,
      priority: dag.priority,
      dependencies: Object.freeze(dependencies),
      schedulerMode: "dag",
    }),
    performance: Object.freeze({
      id: job.label,
      jobType: job.label,
      queueClass: lightingWorkerQueueClass,
      domain: spec.domain,
      authority: "visual",
      importance: spec.importance,
      qualityDimensions: resolveLightingQualityDimensions(techniqueName, job.key),
      importanceSignals: resolveLightingImportanceSignals(techniqueName, job.key),
      levels: spec.levels,
    }),
    debug: Object.freeze({
      owner: lightingDebugOwner,
      queueClass: lightingWorkerQueueClass,
      jobType: job.label,
      tags: Object.freeze([
        "lighting",
        techniqueName,
        job.key,
        spec.domain,
      ]),
      suggestedAllocationIds: Object.freeze([...spec.suggestedAllocationIds]),
    }),
  });
}

function buildLightingWorkerManifest(name, technique) {
  const spec = lightingWorkerSpecPresets[name];

  return Object.freeze({
    schemaVersion: 1,
    owner: lightingDebugOwner,
    technique: name,
    description: technique.description,
    queueClass: lightingWorkerQueueClass,
    schedulerMode: "dag",
    suggestedAllocationIds: Object.freeze([...spec.suggestedAllocationIds]),
    jobs: Object.freeze(
      technique.jobs.map((job) => buildWorkerManifestJob(name, job))
    ),
  });
}

export const lightingWorkerManifests = Object.freeze(
  Object.fromEntries(
    Object.entries(lightingTechniques).map(([name, technique]) => [
      name,
      buildLightingWorkerManifest(name, technique),
    ])
  )
);

function getTechniqueJob(technique, key) {
  const job = technique.jobs.find((entry) => entry.key === key);
  if (!job) {
    const available = technique.jobs.map((entry) => entry.key).join(", ");
    throw new Error(
      `Unknown job "${key}" for technique "${technique.name}". ` +
        `Available: ${available}.`
    );
  }
  return job;
}

export function getLightingTechnique(name = defaultLightingTechnique) {
  const technique = lightingTechniques[name];
  if (!technique) {
    const available = lightingTechniqueNames.join(", ");
    throw new Error(`Unknown lighting technique "${name}". Available: ${available}.`);
  }
  return technique;
}

export function getLightingProfile(name = defaultLightingProfile) {
  const profile = lightingProfiles[name];
  if (!profile) {
    const available = lightingProfileNames.join(", ");
    throw new Error(`Unknown lighting profile "${name}". Available: ${available}.`);
  }
  return profile;
}

export function getLightingTechniqueWorkerManifest(
  name = defaultLightingTechnique
) {
  const manifest = lightingWorkerManifests[name];
  if (!manifest) {
    const available = lightingTechniqueNames.join(", ");
    throw new Error(
      `Unknown lighting technique "${name}". Available: ${available}.`
    );
  }
  return manifest;
}

export function getLightingProfileWorkerManifest(
  name = defaultLightingProfile
) {
  const profile = getLightingProfile(name);
  const techniques = profile.techniques.map((techniqueName) =>
    getLightingTechniqueWorkerManifest(techniqueName)
  );
  const lightingBandPlan = createLightingBandPlan({ profile: profile.name });

  return Object.freeze({
    schemaVersion: 1,
    owner: lightingDebugOwner,
    profile: profile.name,
    description: profile.description,
    schedulerMode: "dag",
    techniques: Object.freeze(techniques),
    lightingBands: lightingBandPlan.bands,
    jobs: Object.freeze(techniques.flatMap((technique) => technique.jobs)),
  });
}

const defaultTechnique = getLightingTechnique(defaultLightingTechnique);

export const lightingPreludeWgslUrl = defaultTechnique.preludeUrl;

export const lightingJobLabels = Object.freeze(
  Object.fromEntries(defaultTechnique.jobs.map((job) => [job.key, job.label]))
);

export const lightingJobs = defaultTechnique.jobs.map((job) => ({
  label: job.label,
  url: job.url,
  sourceName: job.sourceName,
}));

function assertNotHtmlWgsl(source, context) {
  const sample = source.slice(0, 200).toLowerCase();
  if (
    sample.includes("<!doctype") ||
    sample.includes("<html") ||
    sample.includes("<meta")
  ) {
    const label = context ? ` for ${context}` : "";
    throw new Error(
      `Expected WGSL${label} but received HTML. Check the URL or server root.`
    );
  }
}

async function loadWgslSource(options = {}) {
  const { wgsl, url, fetcher = globalThis.fetch, base } = options ?? {};
  if (typeof wgsl === "string") {
    assertNotHtmlWgsl(wgsl, "inline WGSL");
    return wgsl;
  }
  if (!url) {
    return null;
  }
  const resolved = url instanceof URL ? url : new URL(url, base ?? baseUrl);
  if (!fetcher || resolved.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const source = await readFile(fileURLToPath(resolved), "utf8");
    assertNotHtmlWgsl(source, resolved.href);
    return source;
  }
  const response = await fetcher(resolved);
  if (!response.ok) {
    const status = "status" in response ? response.status : "unknown";
    const statusText = "statusText" in response ? response.statusText : "";
    const detail = statusText ? `${status} ${statusText}` : `${status}`;
    throw new Error(`Failed to load WGSL (${detail})`);
  }
  const source = await response.text();
  assertNotHtmlWgsl(source, resolved.href);
  return source;
}

async function loadTechniquePrelude(technique, fetcher) {
  const source = await loadWgslSource({ url: technique.preludeUrl, fetcher });
  if (typeof source !== "string") {
    throw new Error(`Failed to load ${technique.name} prelude WGSL source.`);
  }
  return source;
}

async function loadTechniqueJob(technique, job, fetcher) {
  const source = await loadWgslSource({ url: job.url, fetcher });
  if (typeof source !== "string") {
    throw new Error(
      `Failed to load ${technique.name} job "${job.key}" WGSL source.`
    );
  }
  return source;
}

export async function loadLightingTechniquePreludeWgsl(
  techniqueName,
  options = {}
) {
  const { fetcher } = options ?? {};
  const technique = getLightingTechnique(techniqueName);
  return loadTechniquePrelude(technique, fetcher);
}

export async function loadLightingTechniqueJobWgsl(
  techniqueName,
  jobKey,
  options = {}
) {
  const { fetcher } = options ?? {};
  const technique = getLightingTechnique(techniqueName);
  const job = getTechniqueJob(technique, jobKey);
  return loadTechniqueJob(technique, job, fetcher);
}

export async function loadLightingTechniqueJobs(techniqueName, options = {}) {
  const { fetcher } = options ?? {};
  const technique = getLightingTechnique(techniqueName);
  const preludeWgsl = await loadTechniquePrelude(technique, fetcher);
  const jobSources = await Promise.all(
    technique.jobs.map((job) => loadTechniqueJob(technique, job, fetcher))
  );
  const jobs = technique.jobs.map((job, index) => ({
    wgsl: jobSources[index],
    label: job.label,
    sourceName: job.sourceName,
  }));
  return { preludeWgsl, jobs };
}

export async function loadLightingTechniqueWorkerBundle(
  techniqueName = defaultLightingTechnique,
  options = {}
) {
  const technique = getLightingTechnique(techniqueName);
  const { preludeWgsl, jobs } = await loadLightingTechniqueJobs(
    technique.name,
    options
  );

  return {
    technique: technique.name,
    preludeWgsl,
    jobs,
    workerManifest: getLightingTechniqueWorkerManifest(technique.name),
  };
}

export async function loadLightingPreludeWgsl(options = {}) {
  const { fetcher } = options ?? {};
  return loadTechniquePrelude(defaultTechnique, fetcher);
}

export async function loadLightingJobs(options = {}) {
  return loadLightingTechniqueJobs(defaultLightingTechnique, options);
}

export async function loadLightingProfile(profileName, options = {}) {
  const profile = getLightingProfile(profileName);
  const techniques = await Promise.all(
    profile.techniques.map(async (techniqueName) => {
      const { preludeWgsl, jobs } = await loadLightingTechniqueJobs(
        techniqueName,
        options
      );
      return {
        technique: techniqueName,
        preludeWgsl,
        jobs,
      };
    })
  );
  return { profile, techniques };
}

export async function loadLightingProfileWorkerPlan(
  profileName = defaultLightingProfile,
  options = {}
) {
  const profile = getLightingProfile(profileName);
  const techniques = await Promise.all(
    profile.techniques.map((techniqueName) =>
      loadLightingTechniqueWorkerBundle(techniqueName, options)
    )
  );

  return {
    profile,
    techniques,
    lightingBandPlan: createLightingBandPlan({ profile: profile.name }),
    workerManifest: getLightingProfileWorkerManifest(profile.name),
  };
}
