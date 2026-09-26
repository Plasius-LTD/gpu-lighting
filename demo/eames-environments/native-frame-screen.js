import { computeFixedSppTimingStatistics } from "../../scripts/eames-environments/timing-statistics.js";

export const NATIVE_FRAME_TARGETS=Object.freeze({
  "1080p":Object.freeze({width:1920,height:1080}),
  "4k":Object.freeze({width:3840,height:2160}),
});

// A short renderer-only screen may identify a shortfall, never qualify 60 Hz.
export function summarizeNativeFrameScreen({width,height,canvasWidth,canvasHeight,completedFrameTimesMs}) {
  const resolution=Object.keys(NATIVE_FRAME_TARGETS).find(key=>
    NATIVE_FRAME_TARGETS[key].width===width && NATIVE_FRAME_TARGETS[key].height===height);
  if(!resolution || canvasWidth!==width || canvasHeight!==height) throw new RangeError("Require native 1080p or 4K canvas and render dimensions.");
  if(!Array.isArray(completedFrameTimesMs) || completedFrameTimesMs.length<3
    || [...completedFrameTimesMs].some(value=>!Number.isFinite(value)||value<=0)) throw new RangeError("Require at least three positive finite completed-frame timings.");
  const timing=computeFixedSppTimingStatistics(completedFrameTimesMs);
  const sorted=[...completedFrameTimesMs].sort((a,b)=>a-b),frameBudgetMs=1000/60;
  const percentile=ratio=>sorted[Math.ceil(sorted.length*ratio)-1];
  const deadlineMisses=completedFrameTimesMs.filter(value=>value>frameBudgetMs).length;
  return Object.freeze({resolution,width,height,pixels:width*height,frameBudgetMs,timing,
    p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:sorted.at(-1),
    deadlineMisses,deadlineMissRate:deadlineMisses/sorted.length,
    renderThroughputUpperBoundFps:1000/timing.mean,
    screenStatus:deadlineMisses>0?"over-budget":"within-budget-unqualified",qualifies60Hz:false,
    reason:"Short renderer-only screen; sustained application/display and linear-HDR quality evidence still required."});
}
