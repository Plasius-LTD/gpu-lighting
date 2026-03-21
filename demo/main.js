import {
  createLightingBandPlan,
  defaultLightingProfile,
  lightingDistanceBands,
} from "../dist/index.js";
import { mountHarborShowcase } from "./harbor-runtime.js";

const root = globalThis.document?.getElementById("app");
if (!root) {
  throw new Error("Lighting demo root element was not found.");
}

function createState() {
  return {
    profile: defaultLightingProfile,
    importance: "critical",
  };
}

function updateState(state, scene) {
  return {
    ...state,
    importance: scene.stress ? "critical" : "high",
  };
}

function describeState(state, scene) {
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
      "Stress mode preserves continuity but cools the scene and reduces reflection strength.",
    ],
    textState: {
      profile: bandPlan.profile,
      importance: bandPlan.importance,
      nearBand,
      midBand,
      farBand,
    },
    visuals: {
      skyTop: premiumNear ? "#f1f7fb" : "#e8f0f5",
      skyMid: selectiveMid ? "#c5d6e2" : "#b8c7d1",
      skyBottom: "#769bb0",
      seaTop: premiumNear ? "#24556a" : "#214d61",
      seaMid: "#123d52",
      seaBottom: "#092432",
      waterNear: premiumNear ? { r: 0.14, g: 0.41, b: 0.5 } : { r: 0.14, g: 0.35, b: 0.44 },
      waterFar: premiumNear ? { r: 0.28, g: 0.54, b: 0.65 } : { r: 0.24, g: 0.46, b: 0.57 },
      harborWall: premiumNear ? { r: 0.52, g: 0.43, b: 0.34 } : { r: 0.42, g: 0.38, b: 0.34 },
      harborDeck: { r: 0.5, g: 0.34, b: 0.22 },
      harborTower: { r: 0.34, g: 0.32, b: 0.36 },
      flagColor: premiumNear ? { r: 0.8, g: 0.26, b: 0.18 } : { r: 0.66, g: 0.24, b: 0.2 },
      flagMotion: scene.stress ? 0.72 : 0.56,
      waveAmplitude: scene.stress ? 0.9 : 0.7,
      shadowAccent: premiumNear ? 0.1 : 0.04,
      reflectionStrength: premiumNear ? 0.24 : 0.1,
      sunCore: premiumNear ? "rgba(255, 245, 212, 0.92)" : "rgba(240, 233, 210, 0.72)",
    },
  };
}

await mountHarborShowcase({
  root,
  packageName: "@plasius/gpu-lighting",
  title: "Lighting Bands in a 3D Harbor",
  subtitle:
    "Family-coordinated 3D lighting validation with GLTF ships, collision metadata, and visible near/mid/far lighting policy shifts.",
  createState,
  updateState,
  describeState,
});
