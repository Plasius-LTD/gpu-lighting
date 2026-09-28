// Correctness probes only; native room/Eames remains the performance workload.
export function createRoughSplittingScene(name) {
  if (!["black", "emissive", "diffuse-constant"].includes(name)) {
    throw new RangeError("Unknown rough splitting scene");
  }
  const environment = name === "diffuse-constant" ? [0.5, 0.5, 0.5, 1] : [0, 0, 0, 1];
  return {
    displayQuality: true, probeMaximum: 32, probeDepth: 6,
    camera: {position: [0, 0, 3], target: [0, 0, 0], fovYDegrees: 46},
    meshes: [{
      positions: [-100, -100, 0, 100, -100, 0, 100, 100, 0, -100, 100, 0],
      indices: [0, 1, 2, 0, 2, 3],
      materialKind: name === "emissive" ? "emissive" : "diffuse",
      color: [0.6, 0.3, 0.1, 1], emission: name === "emissive" ? [4, 2, 1, 1] : [0, 0, 0, 0],
      roughness: 0.9, metallic: 0,
    }],
    environmentColor: environment, ambientColor: [0, 0, 0, 1],
    environmentLighting: {environmentColor: environment, horizonColor: environment,
      zenithColor: environment, sunColor: [0, 0, 0, 1], intensity: 1},
  };
}

// Frozen before capture: exact black/emission; 2% mean-channel screen for
// diffuse. This is an energy sanity check, not a convergence qualification.
export function validateRoughSplittingProbe(name, image, control) {
  if (!image.length || image.length !== control.length || image.length % 4) throw Error("Invalid probe images");
  const sums = [0, 0, 0], reference = [0, 0, 0];
  for (let i = 0; i < image.length; i++) {
    const channel = i % 4;
    if (!Number.isFinite(image[i]) || image[i] < 0 || !Number.isFinite(control[i])) throw Error("Invalid probe radiance");
    if (channel === 3) {if (image[i] !== 1 || control[i] !== 1) throw Error("Incomplete camera sample");continue;}
    sums[channel] += image[i];reference[channel] += control[i];
    if (name === "black" && image[i] !== 0) throw Error("Black scene has energy");
    if (name === "emissive" && Math.abs(image[i] - [4, 2, 1][channel]) > 1e-6) throw Error(`Emission changed at component ${i}: ${image[i]}, control ${control[i]}, expected ${[4, 2, 1][channel]}`);
  }
  if (name === "diffuse-constant") for (let channel = 0; channel < 3; channel++) {
    if (reference[channel] <= 0 || Math.abs(sums[channel] / reference[channel] - 1) > 0.02) throw Error("Diffuse mean energy changed by more than 2%");
  }
  if (!["black", "emissive", "diffuse-constant"].includes(name)) throw Error("Unknown probe");
  return {meanRgb: sums.map(value => value / (image.length / 4)), referenceMeanRgb: reference.map(value => value / (image.length / 4)), passed: true};
}
