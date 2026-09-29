import test from "node:test";
import assert from "node:assert/strict";
import { compareSamplingRings, assessSamplingExperiment, SAMPLING_EXPERIMENT } from "../demo/eames-environments/sampler-experiment.js";
test("ring metrics preserve signed energy and reject incomplete evidence",()=>{
  const reference=new Float32Array([1,1,1,1,2,2,2,1]);
  const candidate=new Float32Array([0.5,0.5,0.5,1,2,2,2,1]);
  const rings=compareSamplingRings(candidate,reference,{budgets:new Uint8Array([16,32]),bands:[{spp:16,pixels:1},{spp:32,pixels:1}]});
  assert.equal(rings[0].relativeEnergyDrift,-0.5);assert.equal(rings[1].maxAbsoluteError,0);
  assert.throws(()=>compareSamplingRings(candidate,reference,{budgets:[],bands:[]}));
  assert.throws(()=>assessSamplingExperiment([]),/missing/i);
});
test("frozen screen requires every seed/sampler/tier; means cannot stand in for quality qualification",()=>{
  const rows=SAMPLING_EXPERIMENT.samplers.flatMap(sampler=>SAMPLING_EXPERIMENT.seeds.map(seed=>({
    sampler,seed,rings:[32,16,8,4,2,1].map(spp=>({spp,relativeEnergyDrift:sampler==="legacy"?-0.097:0.001}))
  })));
  const result=assessSamplingExperiment(rows);assert.equal(result.passed,true);assert.equal(result.qualified,false);
  rows.at(-1).rings.at(-1).relativeEnergyDrift=0.1;
  assert.equal(assessSamplingExperiment(rows).passed,false);
  assert.throws(()=>assessSamplingExperiment([...rows,rows[0]]),/duplicate/i);
});
