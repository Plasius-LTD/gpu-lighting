// Prescribed diagnostic policy, not a production importance/performance governor.
// Order pixel centres by Euclidean distance, then row-major ID only for ties.
export const RADIAL_SAMPLING_DEFAULTS=Object.freeze({maximumSpp:32,areaPercent:Object.freeze([5,10,15,20,25,25])});
// Matches the renderer's packed completed-count ABI, not a quality recommendation.
export const RADIAL_MAXIMUM_SPP=256;
export function radialSamplingTiers(maximumSpp=RADIAL_SAMPLING_DEFAULTS.maximumSpp){
  if(!Number.isSafeInteger(maximumSpp)||maximumSpp<1||maximumSpp>RADIAL_MAXIMUM_SPP)
    throw new RangeError(`Radial ceiling must be an integer from 1 to ${RADIAL_MAXIMUM_SPP}.`);
  return RADIAL_SAMPLING_DEFAULTS.areaPercent.map((_,index)=>Math.max(1,Math.ceil(maximumSpp/2**index)));
}
export function createRadialSamplingPlan(width,height,maximumSpp=RADIAL_SAMPLING_DEFAULTS.maximumSpp) {
  const spp=radialSamplingTiers(maximumSpp);
  const pixels=width*height;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||pixels<20||pixels>3840*2160)
    throw new RangeError("Radial plan requires bounded integer dimensions (20 pixels through native 4K).");
  const maximum=(width-1)**2+(height-1)**2;
  const countWithin=radius=>{
    let count=0;
    for(let y=0;y<height;y++){
      const rest=radius-(2*y+1-height)**2;
      if(rest<0)continue;
      const dx=Math.sqrt(rest),left=Math.max(0,Math.ceil((width-1-dx)/2)),right=Math.min(width-1,Math.floor((width-1+dx)/2));
      count+=Math.max(0,right-left+1);
    }
    return count;
  };
  let cumulativePercent=0;
  const percent=RADIAL_SAMPLING_DEFAULTS.areaPercent.map(p=>cumulativePercent+=p);
  let previous=0;
  const bands=percent.map((p,index)=>{
    const target=Math.floor(pixels*p/100);
    let low=0,high=maximum;
    while(low<high){const middle=Math.floor((low+high)/2);if(countWithin(middle)>=target)high=middle;else low=middle+1;}
    let ties=target-countWithin(low-1),lastTiePixel=-1;
    for(let y=0;y<height&&ties>0;y++){
      const rest=low-(2*y+1-height)**2;
      if(rest<0)continue;
      const dx=Math.sqrt(rest);
      const candidates=dx===0?[(width-1)/2]:[(width-1-dx)/2,(width-1+dx)/2];
      for(const x of candidates)if(ties>0&&Number.isInteger(x)&&x>=0&&x<width){lastTiePixel=y*width+x;ties--;}
    }
    const band=Object.freeze({spp:spp[index],pixels:target-previous,radiusSquared:low,lastTiePixel});
    previous=target;return band;
  });
  const BudgetArray=maximumSpp>0xff?Uint16Array:Uint8Array;
  const budgets=new BudgetArray(pixels);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const id=y*width+x,d=(2*x+1-width)**2+(2*y+1-height)**2;
    for(const band of bands)if(d<band.radiusSquared||(d===band.radiusSquared&&id<=band.lastTiePixel)){budgets[id]=band.spp;break;}
  }
  const totalSamples=bands.reduce((sum,band)=>sum+band.spp*band.pixels,0);
  return Object.freeze({width,height,budgets,bands:Object.freeze(bands),totalSamples,meanSpp:totalSamples/pixels});
}
