import { compareLinearImages } from "./paired-adaptive-metrics.js";
export const SAMPLING_EXPERIMENT=Object.freeze({
  samplers:Object.freeze(["legacy","independent-random","owen-sobol"]),
  seeds:Object.freeze([7,19,43]), maximumAbsoluteMeanRingDrift:0.01,
  minimumSixteenSppImprovement:0.8, historicalFixed1080pSha256:"1a80ccffb35002018130e70a1b9b33d7b0869f91af7eb7248cd13ec1692ad211",
});
export function compareSamplingRings(image,reference,plan){
  if(!plan.budgets?.length||image.length!==plan.budgets.length*4||reference.length!==image.length)throw new Error("Invalid ring dimensions");
  return plan.bands.map(band=>{
    const candidate=new Float32Array(band.pixels*4),baseline=new Float32Array(band.pixels*4);let offset=0;
    for(let id=0;id<plan.budgets.length;id++)if(plan.budgets[id]===band.spp){candidate.set(image.subarray(id*4,id*4+4),offset);baseline.set(reference.subarray(id*4,id*4+4),offset);offset+=4;}
    if(offset!==band.pixels*4)throw new Error("Invalid ring pixel count");
    return {spp:band.spp,...compareLinearImages(candidate,baseline)};
  });
}
export function assessSamplingExperiment(rows){
  const results={};
  for(const sampler of SAMPLING_EXPERIMENT.samplers){
    results[sampler]=[16,8,4,2,1].map(spp=>{
      const perSeed=SAMPLING_EXPERIMENT.seeds.map(seed=>{
        const found=rows.filter(row=>row.sampler===sampler&&row.seed===seed);
        if(found.length!==1)throw new Error("Missing or duplicate sampler/seed evidence");
        const rings=found[0].rings.filter(ring=>ring.spp===spp);
        if(rings.length!==1||!Number.isFinite(rings[0].relativeEnergyDrift))throw new Error("Missing or duplicate ring evidence");
        return {seed,drift:rings[0].relativeEnergyDrift};
      });
      const meanSignedDrift=perSeed.reduce((s,v)=>s+v.drift,0)/perSeed.length;
      return {spp,perSeed,meanSignedDrift,bandPassed:Math.abs(meanSignedDrift)<=SAMPLING_EXPERIMENT.maximumAbsoluteMeanRingDrift};
    });
  }
  const legacy=Math.abs(results.legacy[0].meanSignedDrift);
  const controls=Object.fromEntries(["independent-random","owen-sobol"].map(mode=>{
    const improvement=legacy>0?1-Math.abs(results[mode][0].meanSignedDrift)/legacy:0;
    return [mode,{improvement,passed:results[mode].every(r=>r.bandPassed)&&improvement>=SAMPLING_EXPERIMENT.minimumSixteenSppImprovement}];
  }));
  return {passed:Object.values(controls).every(c=>c.passed),qualified:false,results,controls,
    limitation:"Diagnostic brightness-band screen only; fixed32 is not a converged reference. No full image quality or performance qualification."};
}
