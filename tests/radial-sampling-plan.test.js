import test from "node:test";
import assert from "node:assert/strict";
import { createRadialSamplingPlan } from "../demo/eames-environments/radial-sampling-plan.js";

test("native area shares give exactly 5.95 SPP, independently of aspect and resolution",()=>{
  for(const [width,height] of [[1920,1080],[3840,2160],[40,25],[25,40]]){
    const plan=createRadialSamplingPlan(width,height),histogram=new Map();
    for(const n of plan.budgets)histogram.set(n,(histogram.get(n)??0)+1);
    assert.deepEqual([...histogram.keys()].sort((a,b)=>b-a),[32,16,8,4,2,1]);
    assert.deepEqual(plan.bands.map(b=>histogram.get(b.spp)),[5,10,15,20,25,25].map(p=>width*height*p/100));
    assert.equal(plan.totalSamples,width*height*5.95);
    assert.equal(plan.meanSpp,5.95);
    assert.equal(plan.budgets[Math.floor(height/2)*width+Math.floor(width/2)],32);
    assert.equal(plan.budgets[0],1);
  }
});

test("circular distance order and deterministic boundary ties preserve exact cumulative areas",()=>{
  for(const [width,height] of [[21,23],[32,18],[19,21]]){
    const plan=createRadialSamplingPlan(width,height),ordered=[];
    for(let id=0;id<width*height;id++)ordered.push({id,d:(2*(id%width)+1-width)**2+(2*Math.floor(id/width)+1-height)**2});
    ordered.sort((a,b)=>a.d-b.d||a.id-b.id);
    let start=0;
    for(const [i,p] of [5,15,30,50,75,100].entries()){
      const end=Math.floor(width*height*p/100);
      assert.equal(plan.bands[i].pixels,end-start);
      for(let rank=start;rank<end;rank++)assert.equal(plan.budgets[ordered[rank].id],[32,16,8,4,2,1][i]);
      start=end;
    }
    assert.deepEqual(createRadialSamplingPlan(width,height).budgets,plan.budgets);
  }
});

test("radial plan rejects unbounded, missing and fractional dimensions before allocation",()=>{
  for(const pair of [[0,1080],[1920,NaN],[3841,2160],[1,1],[1920.5,1080],['1920',1080],[Infinity,1]])
    assert.throws(()=>createRadialSamplingPlan(...pair),RangeError);
});
