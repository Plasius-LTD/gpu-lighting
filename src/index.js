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
