import test from "node:test";
import assert from "node:assert/strict";
import { meanLinearReference, assessFixedPattern } from "../demo/eames-environments/fixed-pattern-experiment.js";
test("common reference averages three complete linear images, never tone mapped images",()=>{
  const images=[1,2,6].map(x=>new Float32Array([x,x,x,1]));
  assert.deepEqual([...meanLinearReference(images)],[3,3,3,1]);
  assert.throws(()=>meanLinearReference(images.slice(1)));
  images[0][0]=NaN;assert.throws(()=>meanLinearReference(images));
});
test("static identical results cannot qualify biased deterministic output",()=>{
  const rings=[16,8,4,2,1].map(spp=>({spp,relativeEnergyDrift:0.002}));
  const good=assessFixedPattern(["a","a","a"],rings);
  assert.equal(good.repeatable,true);assert.equal(good.bandScreenPassed,true);assert.equal(good.qualified,false);
  assert.equal(assessFixedPattern(["a","b","a"],rings).repeatable,false);
  rings[4].relativeEnergyDrift=0.03;assert.equal(assessFixedPattern(["a","a","a"],rings).bandScreenPassed,false);
  assert.throws(()=>assessFixedPattern(["a"],rings));
  assert.throws(()=>assessFixedPattern(["a","a","a"],rings.slice(1)));
});
