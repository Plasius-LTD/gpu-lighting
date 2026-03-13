const baseUrl = (() => {
  if (typeof __IMPORT_META_URL__ !== "undefined") {
    return new URL("./index.js", __IMPORT_META_URL__);
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

export const lightingWorkerQueueClass = "lighting";
export const lightingDebugOwner = "lighting";

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

function buildWorkerManifestJob(techniqueName, job) {
  const spec = lightingWorkerSpecPresets[techniqueName].jobs[job.key];

  return Object.freeze({
    key: job.key,
    label: job.label,
    worker: Object.freeze({
      jobType: job.label,
      queueClass: lightingWorkerQueueClass,
    }),
    performance: Object.freeze({
      id: job.label,
      jobType: job.label,
      queueClass: lightingWorkerQueueClass,
      domain: spec.domain,
      authority: "visual",
      importance: spec.importance,
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

  return Object.freeze({
    schemaVersion: 1,
    owner: lightingDebugOwner,
    profile: profile.name,
    description: profile.description,
    techniques: Object.freeze(techniques),
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
    workerManifest: getLightingProfileWorkerManifest(profile.name),
  };
}
