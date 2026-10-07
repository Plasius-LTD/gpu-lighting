import test from "node:test";
import assert from "node:assert/strict";
import { NATIVE_FRAME_TARGETS, summarizeNativeFrameScreen } from "../demo/eames-environments/native-frame-screen.js";

const input=(timings=[16,17,20])=>({width:1920,height:1080,canvasWidth:1920,canvasHeight:1080,completedFrameTimesMs:timings});
test("native 1080p screen reports tails and all deadline misses, never real-time qualification",()=>{
  const values=[16,17,20]; const report=summarizeNativeFrameScreen(input(values));
  assert.equal(report.resolution,"1080p");assert.equal(report.pixels,2073600);
  assert.equal(report.frameBudgetMs,1000/60);assert.equal(report.deadlineMisses,2);
  assert.equal(report.deadlineMissRate,2/3);assert.equal(report.p50Ms,17);
  assert.equal(report.p95Ms,20);assert.equal(report.p99Ms,20);assert.equal(report.maxMs,20);
  assert.equal(report.timing.mean,53/3);assert.ok(Math.abs(report.renderThroughputUpperBoundFps-3000/53)<1e-12);
  assert.equal(report.screenStatus,"over-budget");assert.equal(report.qualifies60Hz,false);
  assert.deepEqual(values,[16,17,20]);assert.ok(Object.isFrozen(report));
});
test("4K is native and fast short screens cannot prove qualification",()=>{
  const target=NATIVE_FRAME_TARGETS["4k"];
  const report=summarizeNativeFrameScreen({...input([1,2,3]),...target,canvasWidth:target.width,canvasHeight:target.height});
  assert.equal(report.pixels,8294400);assert.equal(report.resolution,"4k");
  assert.equal(report.deadlineMisses,0);assert.equal(report.screenStatus,"within-budget-unqualified");
  assert.equal(report.qualifies60Hz,false);assert.ok(Object.isFrozen(target));
});
test("exact 60 Hz deadline is included, not rounded into failure",()=>{
  const report=summarizeNativeFrameScreen(input([1000/60,1000/60,1000/60]));
  assert.equal(report.deadlineMisses,0);assert.equal(report.qualifies60Hz,false);
});
test("tiny, intermediate, CSS-upscaled and missing native evidence is rejected",()=>{
  for(const fields of [{width:128,height:128},{width:1280,height:720},{width:2560,height:1440},
    {width:3840,height:2160},{canvasWidth:128},{canvasHeight:undefined},{width:"1920"}]) {
    assert.throws(()=>summarizeNativeFrameScreen({...input(),...fields}),/native/);
  }
});
test("missing, sparse, non-finite, zero or negative timings cannot manufacture a pass",()=>{
  for(const values of [undefined,[],[1,2],[1,NaN,2],[1,Infinity,2],[1,0,2],[1,-1,2],[1,"2",3],new Array(3)]){
    assert.throws(()=>summarizeNativeFrameScreen({...input(),completedFrameTimesMs:values}),/timings/);
  }
});
