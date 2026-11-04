import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateRefinementBuild({code,sourceMap,sources}) {
 const map=JSON.parse(sourceMap);
 if(!code.includes('planWavefrontRefinement')||map.version!==3||!Array.isArray(map.sources)||!map.sources.length||!Array.isArray(map.sourcesContent)||map.sources.length!==map.sourcesContent.length)throw Error('Missing refinement bundle/source-map evidence');
 for(const [i,name] of map.sources.entries()){
  if(!name.startsWith('../src/')||name.includes('/../')||sources.get(name.slice(3))!==map.sourcesContent[i])throw Error('Refinement bundle source map is stale or outside committed source');
 }
 return {bundleSha256:sha256(code),sourceMapSha256:sha256(sourceMap),sourceCount:map.sources.length};
}

export function addCommittedRefinementPolicy(snapshot,root) {
 const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024}).toString();
 if(git('status','--porcelain').length)throw Error('Performance checkout must be clean before capture');
 const commit=git('rev-parse','HEAD').trim(),sources=new Map();
 for(const file of git('ls-tree','-rz','--name-only',commit,'src').split('\0').filter(p=>p.endsWith('.ts')))sources.set(file,git('show',commit+':'+file));
 const code=readFileSync(path.join(root,'dist/index.js'),'utf8'),sourceMap=readFileSync(path.join(root,'dist/index.js.map'),'utf8');
 const build=validateRefinementBuild({code,sourceMap,sources});
 const bodies=new Map(snapshot.bodies);bodies.set('/performance/refinement.js',Buffer.from(code));bodies.set('/performance/index.js.map',Buffer.from(sourceMap));
 return {...snapshot,bodies,sources:{...snapshot.sources,performance:commit,performanceBuild:build}};
}
