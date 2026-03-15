import assert from "node:assert/strict";
import test from "node:test";

const originalImportMetaUrl = globalThis.__IMPORT_META_URL__;
globalThis.__IMPORT_META_URL__ = new URL("../src/index.js", import.meta.url);
const {
  createLightingBandPlan,
  getLightingProfileWorkerManifest,
  lightingDistanceBands,
} = await import("../src/index.js");
if (typeof originalImportMetaUrl === "undefined") {
  delete globalThis.__IMPORT_META_URL__;
} else {
  globalThis.__IMPORT_META_URL__ = originalImportMetaUrl;
}

test("lighting band plans declare near, mid, far, and horizon bands with primary shadow sources", () => {
  const plan = createLightingBandPlan({
    profile: "realtime",
    importance: "high",
  });

  assert.deepEqual(lightingDistanceBands, ["near", "mid", "far", "horizon"]);
  assert.deepEqual(plan.bands.map((band) => band.band), [
    "near",
    "mid",
    "far",
    "horizon",
  ]);
  assert.deepEqual(
    plan.bands.map((band) => band.primaryShadowSource),
    [
      "ray-traced-primary",
      "selective-raster-and-proxy",
      "merged-proxy-casters",
      "baked-impression",
    ]
  );
});

test("lighting band plans scale RT shadows, reflections, and GI independently", () => {
  const highImportance = createLightingBandPlan({
    profile: "reference",
    importance: "critical",
  });
  const midImportance = createLightingBandPlan({
    profile: "realtime",
    importance: "medium",
  });

  const nearCritical = highImportance.bands.find((band) => band.band === "near");
  const midMedium = midImportance.bands.find((band) => band.band === "mid");

  assert.deepEqual(nearCritical.rtParticipation, {
    directShadows: "premium",
    reflections: "premium",
    globalIllumination: "premium",
  });
  assert.deepEqual(midMedium.rtParticipation, {
    directShadows: "proxy",
    reflections: "proxy",
    globalIllumination: "disabled",
  });
});

test("lighting band plans make temporal reuse and update cadence explicit", () => {
  const plan = createLightingBandPlan({
    profile: "hybrid",
    importance: "high",
  });

  assert.deepEqual(
    plan.bands.map((band) => ({
      band: band.band,
      temporalReuse: band.temporalReuse,
      updateCadenceDivisor: band.updateCadenceDivisor,
    })),
    [
      { band: "near", temporalReuse: "balanced", updateCadenceDivisor: 1 },
      { band: "mid", temporalReuse: "aggressive", updateCadenceDivisor: 2 },
      { band: "far", temporalReuse: "high", updateCadenceDivisor: 8 },
      { band: "horizon", temporalReuse: "baked", updateCadenceDivisor: 60 },
    ]
  );
});

test("near-field lighting stays on the premium RT path for important content", () => {
  const plan = createLightingBandPlan({
    profile: "reference",
    importance: "critical",
  });
  const near = plan.bands.find((band) => band.band === "near");

  assert.equal(near.liveObjectShadows, true);
  assert.deepEqual(near.rtParticipation, {
    directShadows: "premium",
    reflections: "premium",
    globalIllumination: "premium",
  });
});

test("mid-field lighting relies on selective raster shadowing and proxy casters", () => {
  const plan = createLightingBandPlan({
    profile: "realtime",
    importance: "high",
  });
  const mid = plan.bands.find((band) => band.band === "mid");

  assert.equal(mid.primaryShadowSource, "selective-raster-and-proxy");
  assert.deepEqual(mid.assistShadowSources, [
    "regional-shadow-map",
    "proxy-caster",
    "temporal-history",
  ]);
  assert.equal(mid.rtParticipation.directShadows, "selective");
});

test("horizon lighting is treated as a baked far-field impression", () => {
  const plan = createLightingBandPlan({
    profile: "realtime",
    importance: "high",
  });
  const horizon = plan.bands.find((band) => band.band === "horizon");
  const workerManifest = getLightingProfileWorkerManifest("realtime");

  assert.equal(horizon.impressionOnly, true);
  assert.equal(horizon.liveObjectShadows, false);
  assert.deepEqual(horizon.rtParticipation, {
    directShadows: "disabled",
    reflections: "disabled",
    globalIllumination: "disabled",
  });
  assert.deepEqual(workerManifest.lightingBands.map((band) => band.band), [
    "near",
    "mid",
    "far",
    "horizon",
  ]);
});
