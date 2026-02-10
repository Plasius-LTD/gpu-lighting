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
  lightingProfileNames,
  lightingProfiles,
  lightingPreludeWgslUrl,
  lightingTechniqueNames,
  lightingTechniques,
  loadLightingProfile,
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
