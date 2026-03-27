import {
  createLightingBandPlan,
  defaultLightingProfile,
  lightingDistanceBands,
} from "../dist/index.js";

export function createLightingDemoState() {
  return {
    profile: defaultLightingProfile,
    importance: "critical",
  };
}

export function updateLightingDemoState(state, scene) {
  return {
    ...state,
    importance: scene.stress ? "critical" : "high",
  };
}

export function describeLightingDemoState(state, scene) {
  const bandPlan = createLightingBandPlan({
    profile: state.profile,
    importance: state.importance,
  });
  const nearBand = bandPlan.bands.find((entry) => entry.band === "near") ?? bandPlan.bands[0];
  const midBand = bandPlan.bands.find((entry) => entry.band === "mid") ?? bandPlan.bands[1];
  const farBand = bandPlan.bands.find((entry) => entry.band === "far") ?? bandPlan.bands[2];
  const premiumNear = nearBand.rtParticipation.directShadows === "premium";
  const selectiveMid = midBand.rtParticipation.directShadows === "selective";

  return {
    status: `Lighting live · ${bandPlan.profile} profile · ${lightingDistanceBands.length} bands`,
    details:
      `Near field uses ${nearBand.primaryShadowSource}, mid field uses ${midBand.primaryShadowSource}, and far field falls back to ${farBand.primaryShadowSource}.`,
    sceneMetrics: [
      `ships: ${scene.ships.length} GLTF hulls`,
      `collisions: ${scene.collisions}`,
      `profile: ${bandPlan.profile}`,
      `importance: ${bandPlan.importance}`,
    ],
    qualityMetrics: [
      `near shadows: ${nearBand.primaryShadowSource}`,
      `mid shadows: ${midBand.primaryShadowSource}`,
      `far shadows: ${farBand.primaryShadowSource}`,
      `near reflections: ${nearBand.rtParticipation.reflections}`,
      `mid GI: ${midBand.rtParticipation.globalIllumination}`,
    ],
    debugMetrics: [
      `near cadence divisor: ${nearBand.updateCadenceDivisor}x`,
      `mid cadence divisor: ${midBand.updateCadenceDivisor}x`,
      `far cadence divisor: ${farBand.updateCadenceDivisor}x`,
      `horizon impression: ${bandPlan.bands[3]?.impressionOnly ? "yes" : "no"}`,
    ],
    notes: [
      "This demo now runs on the shared @plasius/gpu-shared harbor runtime instead of carrying its own renderer copy.",
      "The near field keeps premium lighting behavior while mid and far fields visibly step down.",
      "Stress mode preserves continuity but cools the moonlit harbor and reduces reflection strength.",
    ],
    textState: {
      profile: bandPlan.profile,
      importance: bandPlan.importance,
      nearBand,
      midBand,
      farBand,
    },
    visuals: {
      waterNear: premiumNear ? { r: 0.1, g: 0.27, b: 0.39 } : { r: 0.08, g: 0.23, b: 0.34 },
      waterFar: premiumNear ? { r: 0.2, g: 0.39, b: 0.52 } : { r: 0.16, g: 0.31, b: 0.44 },
      harborWall: premiumNear ? { r: 0.31, g: 0.27, b: 0.29 } : { r: 0.24, g: 0.22, b: 0.28 },
      harborDeck: { r: 0.35, g: 0.23, b: 0.17 },
      harborTower: { r: 0.24, g: 0.24, b: 0.3 },
      flagColor: premiumNear ? { r: 0.8, g: 0.26, b: 0.18 } : { r: 0.66, g: 0.24, b: 0.2 },
      flagMotion: scene.stress ? 0.72 : 0.56,
      waveAmplitude: scene.stress ? 0.9 : 0.7,
      shadowAccent: premiumNear ? 0.1 : 0.04,
      reflectionStrength: premiumNear ? 0.24 : 0.1,
      moonCore: premiumNear ? "rgba(243, 247, 255, 0.98)" : "rgba(225, 233, 249, 0.86)",
      moonHalo: premiumNear ? "rgba(176, 200, 255, 0.28)" : "rgba(138, 160, 212, 0.18)",
      lanternReflectionStrength: premiumNear ? 0.54 : 0.38,
      ambientMist: selectiveMid ? "rgba(36, 59, 89, 0.14)" : "rgba(54, 74, 116, 0.18)",
    },
  };
}

export function createLightingDemoMountOptions(root) {
  return {
    root,
    packageName: "@plasius/gpu-lighting",
    title: "Lighting Bands in a 3D Harbor",
    subtitle:
      "Family-coordinated moonlit harbor lighting validation with GLTF ships, collision metadata, and visible near/mid/far policy shifts.",
    createState: createLightingDemoState,
    updateState: updateLightingDemoState,
    describeState: describeLightingDemoState,
  };
}
