import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRefinementBuild,addCommittedRefinementPolicy} from '../scripts/eames-environments/refinement-policy-source.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const code='export function planWavefrontRefinement(){}';
const source='export const current=true;';
test('development policy mount binds bundle/map bytes to immutable source content',()=>{
 const input={code,sourceMap:JSON.stringify({version:3,sources:['../src/index.ts'],sourcesContent:[source]}),sources:new Map([['src/index.ts',source]])};
 const result=validateRefinementBuild(input);assert.equal(result.sourceCount,1);assert.match(result.bundleSha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>validateRefinementBuild({...input,sources:new Map([['src/index.ts','changed']])}),/stale/);
 for(const patch of [{sourceMap:'{}'},{sourceMap:JSON.stringify({version:3,sources:['../../elsewhere.ts'],sourcesContent:[source]})},{code:''}])assert.throws(()=>validateRefinementBuild({...input,...patch}));
});
test('optional policy mount refuses dirty sources and retains a reproducible commit/build pin',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'refinement-source-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'}).toString();
 try{
  await mkdir(path.join(root,'src'));await mkdir(path.join(root,'dist'));
  await writeFile(path.join(root,'.gitignore'),'dist/\n');await writeFile(path.join(root,'src/index.ts'),source);
  git('init','-q');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','policy fixture');
  await writeFile(path.join(root,'dist/index.js'),code);await writeFile(path.join(root,'dist/index.js.map'),JSON.stringify({version:3,sources:['../src/index.ts'],sourcesContent:[source]}));
  const original={bodies:new Map(),sources:{renderer:'renderer-pin'}},snapshot=addCommittedRefinementPolicy(original,root);
  assert.equal(original.bodies.size,0);assert.equal(snapshot.sources.performance,git('rev-parse','HEAD').trim());
  assert.equal(snapshot.bodies.get('/performance/refinement.js').toString(),code);assert.equal(snapshot.sources.performanceBuild.sourceCount,1);
  await writeFile(path.join(root,'src/index.ts'),'changed');assert.throws(()=>addCommittedRefinementPolicy(original,root),/clean/);
 }finally{await rm(root,{recursive:true,force:true});}
});
