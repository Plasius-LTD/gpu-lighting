export function meanLinearReference(images) {
  if (!Array.isArray(images) || images.length !== 3 || !(images[0] instanceof Float32Array) || !images[0].length || images[0].length % 4) throw new Error("Require three linear reference images");
  const result = new Float32Array(images[0].length);
  for (const image of images) {
    if (!(image instanceof Float32Array) || image.length !== result.length) throw new Error("Reference size mismatch");
    for (let i=0;i<image.length;i++) {
      if (!Number.isFinite(image[i]) || image[i]<0 || (i%4===3 && image[i]!==1)) throw new Error("Invalid linear reference");
    }
  }
  for (let i=0;i<result.length;i++) result[i] = i%4===3 ? 1 : (images[0][i]+images[1][i]+images[2][i])/3;
  return result;
}

export function assessFixedPattern(hashes, rings) {
  if (!Array.isArray(hashes) || hashes.length!==3 || hashes.some(h=>typeof h!=="string" || !h)) throw new Error("Require three repeat hashes");
  const selected=[16,8,4,2,1].map(spp=>{
    const values=rings.filter(r=>r.spp===spp);
    if(values.length!==1 || !Number.isFinite(values[0].relativeEnergyDrift)) throw new Error("Missing ring evidence");
    return values[0];
  });
  return {repeatable:new Set(hashes).size===1,bandScreenPassed:selected.every(r=>Math.abs(r.relativeEnergyDrift)<=0.01),qualified:false,
    limitation:"Static repeatability is not accuracy; common 96-sample reference is not certified converged. Motion, full quality and performance qualification remain open."};
}
