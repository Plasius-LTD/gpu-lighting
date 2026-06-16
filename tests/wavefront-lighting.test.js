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
  createWavefrontReferenceFixture,
  createWavefrontVisibilityProbeRay,
  evaluateWavefrontContinuationEvent,
  evaluateWavefrontMaterialReference,
  evaluateWavefrontMediumState,
  evaluateWavefrontTerminalRadiance,
  evaluateWavefrontVisibilityProbe,
  getLightingTechnique,
  getLightingTechniqueWorkerManifest,
  lightingWavefrontBufferContracts,
  lightingWavefrontPassOrder,
  lightingWavefrontRayKinds,
  lightingWavefrontTerminationPolicy,
  lightingWavefrontVisibilityProbeModes,
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

function assertVec3Within(actual, expected, tolerance) {
  actual.forEach((component, index) => {
    assert.ok(
      Math.abs(component - expected[index]) <= tolerance,
      `component ${index} expected ${expected[index]} but got ${component}`
    );
  });
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

function assertRendererCompatibleContracts(actualContracts, expectedContracts) {
  for (const [recordKey, expectedRecord] of Object.entries(expectedContracts)) {
    const actualRecord = actualContracts[recordKey];
    assert.ok(actualRecord, `missing ${recordKey} contract`);
    assert.equal(actualRecord.recordName, expectedRecord.recordName);

    const actualFieldIndexes = new Map(
      actualRecord.fields.map((field, index) => [field.name, index])
    );

    for (const expectedField of expectedRecord.fields) {
      const actualFieldIndex = actualFieldIndexes.get(expectedField.name);
      assert.notEqual(
        actualFieldIndex,
        undefined,
        `${recordKey} is missing renderer field ${expectedField.name}`
      );

      const actualField = actualRecord.fields[actualFieldIndex];
      assert.equal(typeof actualField.type, "string");
    }
  }
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
  assertRendererCompatibleContracts(lightingPlan.bufferContracts, rendererPlan.bufferContracts);
  assert.deepEqual(lightingPlan.terminationPolicy, rendererPlan.terminationPolicy);
  assert.deepEqual(lightingPlan.requiredRendererPassOrder, rendererWavefrontPassOrder);
  assert.deepEqual(
    lightingPlan.lightingPasses.map((pass) => pass.key),
    lightingWavefrontPassOrder
  );
  assert.deepEqual(lightingPlan.rayKinds, lightingWavefrontRayKinds);
  assert.equal(lightingPlan.visibilityProbeMode, "mis-balanced");
  assert.deepEqual(lightingWavefrontVisibilityProbeModes, [
    "disabled",
    "mis-balanced",
    "exclusive-emissive",
  ]);
  assert.deepEqual(
    summarizeContracts(lightingPlan.bufferContracts),
    summarizeContracts(lightingWavefrontBufferContracts)
  );
  assertRendererCompatibleContracts(lightingWavefrontBufferContracts, rendererPlan.bufferContracts);
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

test("wavefront continuation reference helpers detect total internal reflection and compact medium carry", () => {
  const tir = evaluateWavefrontContinuationEvent({
    hitType: "surface",
    eventKind: "refraction",
    throughput: [1, 1, 1],
    albedo: [0.75, 0.85, 0.95],
    transmission: [0.94, 0.97, 1],
    shadingNormal: [0, 1, 0],
    viewDirection: [-0.9, -0.2, 0],
    frontFace: false,
    ior: 1.5,
    currentMediumRefId: 7,
    mediumStack: [7],
    surfaceMediumRefId: 7,
  });

  assert.equal(tir.requestedEventKind, "refraction");
  assert.equal(tir.eventKind, "reflection");
  assert.equal(tir.totalInternalReflection, true);
  assert.equal(tir.mediumState.currentMediumRefId, 7);
  assert.deepEqual(tir.mediumState.stack, [7]);

  const enteredWater = evaluateWavefrontMediumState({
    currentMediumRefId: 0,
    mediumStack: [],
    surfaceMediumRefId: 7,
    frontFace: true,
    eventKind: "transparency",
  });
  assert.equal(enteredWater.currentMediumRefId, 7);
  assert.equal(enteredWater.enteredMediumRefId, 7);
  assert.deepEqual(enteredWater.stack, [7]);

  const exitedWater = evaluateWavefrontMediumState({
    currentMediumRefId: 7,
    mediumStack: [7],
    surfaceMediumRefId: 7,
    frontFace: false,
    eventKind: "transparency",
  });
  assert.equal(exitedWater.currentMediumRefId, 0);
  assert.equal(exitedWater.exitedMediumRefId, 7);
  assert.deepEqual(exitedWater.stack, []);
});

test("wavefront visibility probes use shared ray payload fields and avoid double counting emissive hits", () => {
  const probeRay = createWavefrontVisibilityProbeRay({
    rayId: 12,
    parentRayId: 4,
    sourcePixelId: 9,
    sampleId: 2,
    bounce: 1,
    origin: [0, 1, 0],
    direction: [0.25, -1, 0.15],
    throughput: [0.8, 0.7, 0.6],
    mediumRefId: 3,
    mediumStack: [3],
  });

  assert.equal(probeRay.rayKind, "visibility-probe");
  assert.equal(probeRay.flags & 0x3, 1);
  assert.equal(probeRay.mediumRefId, 3);
  assert.deepEqual(probeRay.mediumStack, [3]);

  const exclusive = evaluateWavefrontVisibilityProbe({
    probeRay,
    probeMode: "exclusive-emissive",
    activeEmissiveRadiance: [4, 3, 2],
    emissiveRadiance: [4, 3, 2],
    transparentSegments: [[0.8, 0.8, 0.8]],
  });
  assert.equal(exclusive.doubleCountPrevented, true);
  assert.deepEqual(roundVec3(exclusive.contribution), [0, 0, 0]);

  const misBalanced = evaluateWavefrontVisibilityProbe({
    probeRay,
    probeMode: "mis-balanced",
    activeEmissiveRadiance: [4, 3, 2],
    emissiveRadiance: [4, 3, 2],
    transparentSegments: [
      [0.8, 0.8, 0.8],
      [0.6, 0.7, 0.9],
    ],
  });
  assert.equal(misBalanced.misWeight, 0.5);
  assert.deepEqual(roundVec3(misBalanced.transmittance), [0.48, 0.56, 0.72]);
  assertVec3Within(
    misBalanced.contribution,
    [0.768, 0.588, 0.432],
    0.0001
  );

  const terminal = evaluateWavefrontTerminalRadiance({
    hitType: "emissive",
    throughput: [0.8, 0.7, 0.6],
    emission: [4, 3, 2],
  });
  assertVec3Within(terminal.radiance, [3.2, 2.1, 1.2], 0.0001);
});

test("wavefront material reference fixtures expose buffer-like deterministic outputs within tolerance", () => {
  const reference = evaluateWavefrontMaterialReference({
    hitType: "surface",
    eventKind: "transparency",
    throughput: [0.9, 0.8, 0.7],
    albedo: [0.7, 0.5, 0.3],
    emission: [1.5, 0.5, 0.2],
    roughness: 0.2,
    metalness: 0.1,
    opacity: 0.35,
    transmission: [0.9, 0.85, 0.8],
    ior: 1.33,
    shadingNormal: [0, 1, 0],
    viewDirection: [0, 1, 0],
    currentMediumRefId: 0,
    mediumStack: [],
    surfaceMediumRefId: 11,
  });
  assert.equal(reference.material.refractiveIndex, 1.33);
  assert.deepEqual(reference.material.transmission, [0.9, 0.85, 0.8]);
  assert.deepEqual(reference.continuation.mediumState.stack, [11]);
  assertVec3Within(reference.throughputUpdate, [0.81, 0.68, 0.56], 0.0001);

  const fixture = createWavefrontReferenceFixture({
    rayId: 21,
    parentRayId: 0,
    sourcePixelId: 5,
    sampleId: 1,
    bounceIndex: 0,
    origin: [0, 0, 0],
    viewDirection: [0, 1, 0],
    throughput: [0.9, 0.8, 0.7],
    hitType: "emissive",
    emission: [1.5, 0.5, 0.2],
    opacity: 0.35,
    transmission: [0.9, 0.85, 0.8],
    ior: 1.33,
    currentMediumRefId: 0,
    mediumStack: [],
    surfaceMediumRefId: 11,
    visibilityProbe: {
      probeMode: "mis-balanced",
      emissiveRadiance: [0.6, 0.3, 0.1],
      transparentSegments: [[0.7, 0.8, 0.9]],
    },
  });

  assert.equal(fixture.ray.sourcePixelId, 5);
  assert.equal(fixture.ray.mediumStackDepth, 0);
  assert.equal(fixture.tolerance, 0.0005);
  assert.equal(fixture.accumulation.sampleCount, 1);
  assertVec3Within(fixture.accumulation.radiance, [1.728, 0.592, 0.203], 0.0001);
  assert.ok(fixture.visibilityProbe);
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
  assert.match(prelude, /const RAY_KIND_VISIBILITY_PROBE/);
  assert.match(prelude, /fn ray_kind\(flags: u32\) -> u32/);

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
