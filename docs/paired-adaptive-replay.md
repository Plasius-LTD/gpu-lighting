# Replaying the paired diagnostic

This is the loopback-only setup used for the retained experiment, with captured
commits selected explicitly below. It serves committed source (not worktree edits)
and forwards PNG/JSON retention to the existing lighting capture bridge. It binds
only 127.0.0.1; do not expose it publicly. Existing bridge origin/path/body limits
remain active. No browser automation or external download is required.

Use Node 24 with dependencies installed in both linked worktrees. The example
paths are the original capture checkouts; change only their locations if replaying
elsewhere and ensure both pinned commits are present. With port 5196 free, run the
following as a Node ES module (or through `node --input-type=module`), then open
`http://127.0.0.1:5196/tests/fixtures/adaptive-paired.html` and choose **Measure before
and after**. Stop the local process afterwards. The existing site on 5173 is not
changed. Uploaded evidence stays under `output/playwright/eames-environments`.

```js
import http from 'node:http'; import {execFileSync} from 'node:child_process';
import {createCaptureBridgeServer} from '/Users/philliphounslow/plasius/worktrees/gpu-lighting-adaptive-87/scripts/eames-environments/capture-bridge-server.mjs';
const renderer='/Users/philliphounslow/plasius/worktrees/gpu-renderer-combined-169',lighting='/Users/philliphounslow/plasius/worktrees/gpu-lighting-adaptive-87';
const git=(root,...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
const sources={renderer:'c6d490a7bc8a04122a784f8146cb6e547d0c3902',lighting:'e0f1389454b22eb8afdd0f5031e1b86ea3c8487e'};
const bodies=new Map();for(const [root,commit,prefix,folders] of [[renderer,sources.renderer,'',['src','tests/fixtures']],[lighting,sources.lighting,'/lighting',['demo/eames-environments','scripts/eames-environments']]]){
const files=git(root,'ls-tree','-rz','--name-only',commit,...folders).toString().split('\0').filter(p=>/\.(js|mjs|html)$/.test(p));
for(const file of files)bodies.set(prefix+'/'+file,git(root,'show',commit+':'+file));}
const captureId='paired-adaptive-'+new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
const bridge=createCaptureBridgeServer();
http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1:5196');
if(req.method==='POST'&&url.pathname==='/__plasius-capture'){bridge.emit('request',req,res);return;}
if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
const body=url.pathname==='/__provenance'?Buffer.from(JSON.stringify({sources,source:'immutable-git-objects',captureId})):bodies.get(url.pathname);
if(!body){res.writeHead(404);res.end('Not found');return;}
res.writeHead(200,{'Content-Type':url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname==='/__provenance'?'application/json':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
}).listen(5196,'127.0.0.1',()=>console.log(JSON.stringify({port:5196,sources,captureId})));
```

The [protocol](paired-adaptive-probe.md) fixes workloads and thresholds. See the
[result report](evidence/paired-adaptive-2026-09-20.md) for exclusions and failures.
Recalculate HDR metrics with `compareLinearImages` from
`demo/eames-environments/paired-adaptive-metrics.js`, converting retained JSON RGBA
arrays back to Float32Array. SHA-256 their bytes (including normalized alpha) and
compare with each receipt. Use `assessPairedTimings` on sorted same-round arrays;
never substitute job milliseconds for GPU query milliseconds. Retain raw failed
runs and do not pool timings across instrumentation revisions.

