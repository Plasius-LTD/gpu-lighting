import test from "node:test";
import assert from "node:assert/strict";
import { assessStablePattern } from "../demo/eames-environments/fixed-pattern-experiment.js";

test("stable pattern brightness screen requires complete finite global and regional evidence",()=>{
  const rings=[16,8,4,2,1].map(spp=>({spp,relativeEnergyDrift:0.002}));
  const hashes=["same","same","same"];
  assert.equal(assessStablePattern(hashes,rings,{relativeEnergyDrift:0.002}).brightnessScreenPassed,true);
  assert.equal(assessStablePattern(hashes,rings,{relativeEnergyDrift:-0.032}).brightnessScreenPassed,false);
  assert.equal(assessStablePattern(["a","b","a"],rings,{relativeEnergyDrift:0}).repeatable,false);
  assert.equal(assessStablePattern(hashes,rings,{relativeEnergyDrift:0}).qualified,false);
  assert.throws(()=>assessStablePattern(hashes,rings,{relativeEnergyDrift:NaN}),/global/);
  assert.throws(()=>assessStablePattern(hashes,rings.slice(1),{relativeEnergyDrift:0}),/Missing/);
});
