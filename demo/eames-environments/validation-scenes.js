const validationSceneDefinitions = Object.freeze([
  Object.freeze({
    id: "eames",
    label: "Eames environments",
    family: "eames",
    artifactTargets: Object.freeze([
      "missing textures",
      "background noise regressions",
      "material transport regressions",
    ]),
  }),
  Object.freeze({
    id: "furnace",
    label: "White furnace",
    family: "synthetic",
    artifactTargets: Object.freeze([
      "NaN/Inf pixels",
      "black-block energy loss",
      "furnace energy drift",
    ]),
  }),
  Object.freeze({
    id: "all-material-direct-light",
    label: "All-material direct light",
    family: "synthetic",
    artifactTargets: Object.freeze([
      "material-class direct-light regressions",
      "shadow striping",
      "specular fireflies",
    ]),
  }),
  Object.freeze({
    id: "hdri-skybox",
    label: "HDRI skybox",
    family: "synthetic",
    artifactTargets: Object.freeze([
      "skybox/background noise regressions",
      "environment-miss banding",
      "reflection aliasing",
    ]),
  }),
  Object.freeze({
    id: "dark-terminal-residual",
    label: "Dark terminal residual",
    family: "synthetic",
    artifactTargets: Object.freeze([
      "dark-miss ambient residual drift",
      "near-black noise floor",
      "unbounded terminal lift",
    ]),
  }),
]);

const validationSceneById = new Map(validationSceneDefinitions.map((scene) => [scene.id, scene]));

export function listValidationSceneDefinitions() {
  return validationSceneDefinitions;
}

export function getValidationSceneDefinition(sceneId = "eames") {
  return validationSceneById.get(String(sceneId ?? "eames").trim().toLowerCase()) ?? validationSceneById.get("eames");
}
