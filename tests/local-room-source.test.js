import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLocalRoomGlb,addLocalRoomSnapshot} from '../scripts/eames-environments/local-room-source.mjs';
function glb(patch={}){
 const doc={asset:{version:'2.0'},scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],accessors:[{count:3},{count:3}],...patch};
 const json=Buffer.from(JSON.stringify(doc).padEnd(Math.ceil(JSON.stringify(doc).length/4)*4,' '));
 const b=Buffer.alloc(20+json.length);b.writeUInt32LE(0x46546c67);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);return b;
}
test('local GLB snapshot validates header/static resources and counts reachable instances',()=>{
 const b=glb({nodes:[{mesh:0},{mesh:0}],scenes:[{nodes:[0,1]}]});
 const a=inspectLocalRoomGlb(b,'room.glb');assert.equal(a.primitives,2);assert.equal(a.triangles,2);assert.equal(a.bytes,b.length);assert.match(a.sha256,/^[a-f0-9]{64}$/);
 for(const patch of [{buffers:[{uri:'https://example.com/private'}]},{images:[{uri:'outside.jpg'}]},{extensionsUsed:['unsupported']},{animations:[{}]},{skins:[{}]},{nodes:[{children:[0]}]},{nodes:[{mesh:99}]},{accessors:[{count:3},{count:4}]}])assert.throws(()=>inspectLocalRoomGlb(glb(patch),'room.glb'));
 for(const b of [Buffer.alloc(0),Buffer.alloc(24),glb().subarray(0,24)])assert.throws(()=>inspectLocalRoomGlb(b,'room.glb'));
 const bad=glb();bad.writeUInt32LE(0xffffffff,12);assert.throws(()=>inspectLocalRoomGlb(bad,'room.glb'));
 const json=glb(),binary=Buffer.concat([json,Buffer.alloc(12)]);binary.writeUInt32LE(binary.length,8);binary.writeUInt32LE(4,json.length);binary.writeUInt32LE(0x004e4942,json.length+4);assert.equal(inspectLocalRoomGlb(binary,'embedded.glb').triangles,1);
 for(const name of ['', '../room.glb', 'line\nname'])assert.throws(()=>inspectLocalRoomGlb(glb(),name));
});
test('local room map snapshots private bytes and labels mixed provenance without a source path',()=>{
 const bytes=glb(),snap={bodies:new Map(),sources:{lighting:'a'}};
 const r=addLocalRoomSnapshot(snap,bytes,'room.glb');bytes.fill(0);
 assert.equal(r.source,'immutable-git-code-and-local-asset-snapshot');
 assert.equal(r.bodies.get('/__room-model.glb').readUInt32LE(0),0x46546c67);
 assert.equal(JSON.parse(r.bodies.get('/__room-manifest.json')).name,'room.glb');
 assert.equal(r.assets.room.publication,'local-only-not-approved-for-publication');
 assert.deepEqual(r.sources,{lighting:'a'});assert.equal(snap.bodies.size,0);
});
