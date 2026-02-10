import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const originalImportMetaUrl = globalThis.__IMPORT_META_URL__;
globalThis.__IMPORT_META_URL__ = new URL("../src/index.js", import.meta.url);
const {
  defaultLightingProfile,
  defaultLightingTechnique,
  getLightingProfile,
  getLightingTechnique,
  lightingProfileNames,
  lightingProfiles,
  lightingPreludeWgslUrl,
  lightingTechniqueNames,
  lightingTechniques,
  loadLightingJobs,
  loadLightingPreludeWgsl,
  loadLightingProfile,
  loadLightingTechniqueJobWgsl,
  loadLightingTechniqueJobs,
  loadLightingTechniquePreludeWgsl,
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

test("lighting job WGSL defines process_job entry points", () => {
  for (const techniqueName of lightingTechniqueNames) {
    const technique = lightingTechniques[techniqueName];
    for (const job of technique.jobs) {
      const source = fs.readFileSync(urlToPath(job.url), "utf8");
      assert.ok(/\bfn\s+process_job\b/.test(source));
    }
  }
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
