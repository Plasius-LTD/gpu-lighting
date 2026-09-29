// Small diagnostic scenes, not replacements for the Eames/reference matrix.
export function createPairedProbeScene(name) {
  if (!["smooth-environment", "diffuse-silhouette"].includes(name)) throw new RangeError("Unknown paired probe scene.");
  const quad = (left, right, bottom, top, depth, materialKind, color, emission = [0,0,0,0]) => ({
    positions: [left,bottom,depth, right,bottom,depth, right,top,depth, left,top,depth],
    indices: [0,1,2,0,2,3], materialKind, color, emission, roughness: materialKind === "metal" ? 0 : 1,
    metallic: materialKind === "metal" ? 1 : 0,
  });
  const meshes = name === "smooth-environment"
    ? [quad(-1,1,-1,1,10,"diffuse",[1,1,1,1])]
    : [quad(-0.95,-0.08,-0.9,0.8,0,"diffuse",[0.75,0.25,0.08,1]),
      quad(0.13,0.9,-0.6,0.6,-0.05,"metal",[0.8,0.9,1,1]),
      quad(-0.018,0.018,-1.05,1.05,0.1,"emissive",[1,1,1,1],[4,2,1,1])];
  return { displayQuality: true, meshes, camera: { position:[0,0,3], target:[0,0,0], fovYDegrees:46 },
    environmentLighting: { horizonColor:[0.5,0.6,0.8,1], zenithColor:[2,0.8,0.3,1], sunColor:[0,0,0,1], intensity:1 } };
}

export function createPairedProbeBudgets(width, height, mode) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 16384
    || !["uniform", "reduced"].includes(mode)) throw new RangeError("Invalid probe budget configuration.");
  return Uint32Array.from({length:width * height}, (_, pixel) => {
    if (mode === "uniform") return 32;
    const radius = Math.hypot(((pixel % width + 0.5) / width - 0.5) * width / height, (Math.floor(pixel / width) + 0.5) / height - 0.5);
    return radius < 0.2 ? 32 : radius < 0.45 ? 8 : 2;
  });
}
