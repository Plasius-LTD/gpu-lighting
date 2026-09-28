// Analytic correctness input only. Never used as native scene/performance evidence.
export function createGuidedDenoiseProbe() {
 const width=128,height=128,count=width*height;
 const raw=new Float32Array(count*4),truth=new Float32Array(count*4),normalDepth=new Float32Array(count*4),albedo=new Float32Array(count*4),words=new Uint32Array(count);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const id=y*width+x,o=id*4,right=x>=64;
  const value=y<32?[32,24,18]:right?[3,2,1]:[1,0.5,0.25];
  const noise=y<32?0:(((Math.imul(id+1,1664525)+1013904223)>>>8)%101/100-0.5)*1.0;
  raw.set([...value.map(v=>v+noise*0.4),1],o);truth.set([...value,1],o);
  normalDepth.set([0,0,1,y<32?-2:y<64&&right?2:0],o);
  albedo.set([y>=64&&right?0.8:0.3,0.3,0.3,y>=96?0:1],o);
  const spp=y<64?1:32;words[id]=spp|(spp<<9);
  if(x===0&&y>=96){raw[o+3]=0;words[id]=0x80000000;}
 }
 return {width,height,raw,truth,normalDepth,albedo,words};
}

export function evaluateGuidedDenoiseProbe(probe,output) {
 if(!(output instanceof Float32Array)||output.length!==probe.raw.length)throw new Error('Invalid guided probe output');
 let inputError=0,outputError=0,count=0,constantError=0,protectedError=0,invalid=0,edgeError=0;
 for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++){
  const o=(y*probe.width+x)*4;
  if(!Number.isFinite(output[o])||!Number.isFinite(output[o+1])||!Number.isFinite(output[o+2]))throw new Error('Nonfinite filtered probe');
  if(probe.raw[o+3]===0){if(output[o+3]!==0)invalid++;continue;}
  for(let c=0;c<3;c++){
   const e=Math.abs(output[o+c]-probe.truth[o+c]);
   if(y<32)constantError=Math.max(constantError,e);
   else if(y>=96)protectedError=Math.max(protectedError,Math.abs(output[o+c]-probe.raw[o+c]));
   else if(y>=40&&y<56){inputError+=(probe.raw[o+c]-probe.truth[o+c])**2;outputError+=e**2;count++;if(x===63||x===64)edgeError=Math.max(edgeError,e);}
  }
 }
 const rmseRatio=Math.sqrt(outputError/inputError);
 const passed=constantError<=0.001&&protectedError<=0.002&&invalid===0&&rmseRatio<0.65&&edgeError<0.25;
 if(!passed)throw new Error('Guided probe acceptance failed: '+JSON.stringify({constantError,protectedError,invalid,rmseRatio,edgeError}));
 return {passed,constantError,protectedError,invalid,rmseRatio,edgeError,inputRmse:Math.sqrt(inputError/count),outputRmse:Math.sqrt(outputError/count),scope:'synthetic-correctness-not-performance-or-room-convergence'};
}

export function compareDenoisedRadiance(raw,filtered) {
 if(!(raw instanceof Float32Array)||!(filtered instanceof Float32Array)||raw.length!==filtered.length||raw.length%4)throw new Error('Mismatched linear images');
 let rawSum=0,filteredSum=0,squared=0,max=0;
 for(let i=0;i<raw.length;i++){
  if(!Number.isFinite(raw[i])||!Number.isFinite(filtered[i])||raw[i]<0||filtered[i]<0)throw new Error('Invalid linear image');
  if(i%4===3){if(raw[i]!==filtered[i])throw new Error('Denoise changed validity');continue;}
  rawSum+=raw[i];filteredSum+=filtered[i];const d=filtered[i]-raw[i];squared+=d*d;max=Math.max(max,Math.abs(d));
 }
 return {meanRgbRatio:rawSum?filteredSum/rawSum:null,rmseFromRaw:Math.sqrt(squared/(raw.length/4*3)),maxDifferenceFromRaw:max,qualification:'change-from-noisy-input-not-error-from-converged-truth'};
}
