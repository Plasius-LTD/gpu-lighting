import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWavefrontPathTracingPlan,
  rendererWavefrontPassOrder,
  rendererWavefrontQueuePairStrategy,
} from "@plasius/gpu-renderer";

const originalImportMetaUrl = globalThis.__IMPORT_META_URL__;
globalThis.__IMPORT_META_URL__ = new URL("../src/index.js", import.meta.url);
const {
  createWavefrontLightingPlan,
  evaluateWavefrontContinuationEvent,
  evaluateWavefrontTerminalRadiance,
  getLightingTechnique,
  getLightingTechniqueWorkerManifest,
  lightingWavefrontBufferContracts,
  lightingWavefrontPassOrder,
  lightingWavefrontTerminationPolicy,
  loadLightingTechniqueJobs,
  loadLightingTechniqueWorkerBundle,
} = await import("../src/index.js");
if (typeof originalImportMetaUrl === "undefined") {
  delete globalThis.__IMPORT_META_URL__;
} else {
  globalThis.__IMPORT_META_URL__ = originalImportMetaUrl;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function roundVec3(value) {
  return value.map((component) => Number(component.toFixed(4)));
}

function summarizeContracts(contracts) {
  return Object.fromEntries(
    Object.entries(contracts).map(([key, value]) => [
      key,
      {
        recordName: value.recordName,
        fields: value.fields.map((field) => field.name),
      },
    ])
  );
}

test("wavefront lighting plan aligns with renderer queue, buffer, and termination contracts", () => {
  const rendererPlan = createWavefrontPathTracingPlan({
    maxDepth: 5,
    queueCapacity: 2048,
    explicitLightSampling: true,
    accumulationResetEpoch: 9,
  });
  const lightingPlan = createWavefrontLightingPlan({
    maxDepth: 5,
    queueCapacity: 2048,
    explicitLightSampling: true,
    accumulationResetEpoch: 9,
  });

  assert.equal(lightingPlan.queueLayout.strategy, rendererWavefrontQueuePairStrategy);
  assert.deepEqual(lightingPlan.queueLayout, rendererPlan.queueLayout);
  assert.deepEqual(
    summarizeContracts(lightingPlan.bufferContracts),
    summarizeContracts(rendererPlan.bufferContracts)
  );
  assert.deepEqual(lightingPlan.terminationPolicy, rendererPlan.terminationPolicy);
  assert.deepEqual(lightingPlan.requiredRendererPassOrder, rendererWavefrontPassOrder);
  assert.deepEqual(
    lightingPlan.lightingPasses.map((pass) => pass.key),
    lightingWavefrontPassOrder
  );
  assert.deepEqual(
    summarizeContracts(lightingWavefrontBufferContracts),
    summarizeContracts(rendererPlan.bufferContracts)
  );
  assert.deepEqual(lightingWavefrontTerminationPolicy, rendererPlan.terminationPolicy);
});

test("wavefront lighting technique and worker manifest expose the renderer-aligned lighting slice", async () => {
  const technique = getLightingTechnique("wavefront");
  assert.equal(technique.name, "wavefront");
  assert.equal(technique.jobs.length, 2);
  assert.deepEqual(
    technique.jobs.map((job) => job.key),
    ["accumulateTerminalRadiance", "scatterContinuations"]
  );

  const manifest = getLightingTechniqueWorkerManifest("wavefront");
  assert.equal(manifest.queueClass, "lighting");
  assert.equal(manifest.jobs.length, 2);
  assert.deepEqual(
    manifest.jobs.find((job) => job.key === "scatterContinuations").worker.dependencies,
    ["lighting.wavefront.accumulateTerminalRadiance"]
  );

  const bundle = await loadLightingTechniqueWorkerBundle("wavefront");
  assert.equal(bundle.technique, "wavefront");
  assert.equal(bundle.jobs.length, 2);

  const loaded = await loadLightingTechniqueJobs("wavefront");
  assert.equal(loaded.jobs.length, 2);
  assert.ok(
    loaded.jobs.every((job) => typeof job.wgsl === "string" && job.wgsl.includes("process_job"))
  );
});

test("wavefront terminal lighting reference helpers cover emissive, environment, and dark miss termination", () => {
  const emissive = evaluateWavefrontTerminalRadiance({
    hitType: "emissive",
    throughput: [0.5, 0.25, 0.75],
    emission: [4, 2, 1],
  });
  assert.equal(emissive.terminated, true);
  assert.equal(emissive.source, "emissive");
  assert.deepEqual(roundVec3(emissive.radiance), [2, 0.5, 0.75]);

  const environment = evaluateWavefrontTerminalRadiance({
    hitType: "environment",
    throughput: [1, 0.5, 0.25],
    environmentRadiance: [0.2, 0.3, 0.4],
  });
  assert.equal(environment.source, "environment");
  assert.deepEqual(roundVec3(environment.radiance), [0.2, 0.15, 0.1]);

  const miss = evaluateWavefrontTerminalRadiance({
    hitType: "miss",
    throughput: [1, 1, 1],
    environmentRadiance: [0, 0, 0],
  });
  assert.equal(miss.source, "dark");
  assert.equal(miss.nearDarkSample, true);
  assert.deepEqual(roundVec3(miss.radiance), [0.0001, 0.0001, 0.0001]);
});

test("wavefront continuation reference helpers cover reflection, refraction, and transparency events", () => {
  const reflection = evaluateWavefrontContinuationEvent({
    hitType: "surface",
    eventKind: "reflection",
    throughput: [1, 0.8, 0.6],
    albedo: [0.9, 0.7, 0.5],
    metalness: 1,
    roughness: 0.1,
    shadingNormal: [0, 1, 0],
    viewDirection: [0, 1, 0],
  });
  assert.equal(reflection.eventKind, "reflection");
  assert.equal(reflection.continueTracing, true);
  assert.ok(reflection.nextDirection[1] > 0);

  const refraction = evaluateWavefrontContinuationEvent({
    hitType: "surface",
    eventKind: "refraction",
    throughput: [0.9, 0.9, 0.9],
    transmission: [0.92, 0.95, 0.98],
    shadingNormal: [0, 1, 0],
    viewDirection: [0, 1, 0],
    frontFace: true,
    ior: 1.45,
  });
  assert.equal(refraction.eventKind, "refraction");
  assert.equal(refraction.continueTracing, true);
  assert.ok(refraction.nextDirection[1] < 0);

  const transparency = evaluateWavefrontContinuationEvent({
    hitType: "transparent",
    throughput: [0.7, 0.7, 0.7],
    opacity: 0.2,
    viewDirection: [0, 1, 0],
    shadingNormal: [0, 1, 0],
  });
  assert.equal(transparency.eventKind, "transparency");
  assert.equal(transparency.continueTracing, true);
  assert.deepEqual(roundVec3(transparency.nextDirection), [0, -1, 0]);
});

test("wavefront WGSL sources publish terminal-radiance and continuation jobs rather than placeholder kernels", () => {
  const base = path.resolve(__dirname, "..", "src", "techniques", "wavefront");
  const prelude = fs.readFileSync(path.join(base, "prelude.wgsl"), "utf8");
  const accumulate = fs.readFileSync(
    path.join(base, "accumulate-terminal-radiance.job.wgsl"),
    "utf8"
  );
  const scatter = fs.readFileSync(
    path.join(base, "scatter-continuations.job.wgsl"),
    "utf8"
  );

  assert.match(prelude, /struct RayRecord/);
  assert.match(prelude, /struct HitRecord/);
  assert.match(prelude, /struct SurfaceRecord/);
  assert.match(prelude, /struct AccumulationRecord/);
  assert.match(prelude, /fn terminal_radiance_for_hit/);

  assert.match(accumulate, /fn accumulate_terminal_sample/);
  assert.match(accumulate, /terminal_radiance_for_hit/);
  assert.match(accumulate, /@compute\s+@workgroup_size/);
  assert.doesNotMatch(accumulate, /Placeholder/);

  assert.match(scatter, /fn queue_reflection_continuation/);
  assert.match(scatter, /fn queue_refraction_continuation/);
  assert.match(scatter, /fn queue_transparency_continuation/);
  assert.match(scatter, /enable_explicit_light_sampling/);
  assert.doesNotMatch(scatter, /Placeholder/);
});
