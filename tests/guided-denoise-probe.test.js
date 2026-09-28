import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedDenoiseProbe,evaluateGuidedDenoiseProbe,compareDenoisedRadiance} from '../demo/eames-environments/guided-denoise-probe.js';
test('guided analytic truth enforces noise, HDR, edges, protected and invalid pixels',()=>{
 const p=createGuidedDenoiseProbe(),output=p.truth.slice();
 for(let y=96;y<128;y++)output.set(p.raw.subarray(y*128*4,(y+1)*128*4),y*128*4);
 assert.equal(evaluateGuidedDenoiseProbe(p,output).rmseRatio,0);
 assert.throws(()=>evaluateGuidedDenoiseProbe(p,p.raw),/acceptance/);
 const bad=output.slice();bad[0]=16;assert.throws(()=>evaluateGuidedDenoiseProbe(p,bad));
 bad.set(output);bad[96*128*4+3]=1;assert.throws(()=>evaluateGuidedDenoiseProbe(p,bad));
 bad.set(output);bad[(96*128+1)*4]=20;assert.throws(()=>evaluateGuidedDenoiseProbe(p,bad));
 bad.set(output);bad[32]=NaN;assert.throws(()=>evaluateGuidedDenoiseProbe(p,bad));
 assert.throws(()=>evaluateGuidedDenoiseProbe(p,new Float32Array(4)));
});
test('room metrics distinguish input differences from quality and reject missing/invalid data',()=>{
 const raw=new Float32Array([2,1,3,1]),same=compareDenoisedRadiance(raw,raw);
 assert.equal(same.meanRgbRatio,1);assert.equal(same.rmseFromRaw,0);
 assert.match(same.qualification,/not-error/);
 assert.equal(compareDenoisedRadiance(new Float32Array(4),new Float32Array(4)).meanRgbRatio,null);
 for(const bad of [new Float32Array(8),new Float32Array([-1,1,1,1]),new Float32Array([NaN,1,1,1]),new Float32Array([1,1,1,0])])assert.throws(()=>compareDenoisedRadiance(raw,bad));
});
