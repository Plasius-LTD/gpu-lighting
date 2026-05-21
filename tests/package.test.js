import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const originalImportMetaUrl = globalThis.__IMPORT_META_URL__;
globalThis.__IMPORT_META_URL__ = new URL("../src/index.js", import.meta.url);
const {
  createLightingProfileModeLadder,
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
  lightingPreludeWgslUrl,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function urlToPath(url) {
  return fileURLToPath(url);
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
