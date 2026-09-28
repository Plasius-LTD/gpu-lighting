import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {composeRoomEamesScene,ROOM_ASSET,ROOM_DEFAULTS,roomReferenceSettings,validateRoomFrame} from "../demo/eames-environments/room-eames.js";

const triangle=[-1,0,-1,1,0,-1,0,1,1];
function inputs(){
 const mesh={positions:triangle,indices:new Array(3*265468).fill(0),normals:[1,0,0,1,0,0,1,0,0],uvs:[0,0,1,0,0,1],material:{baseColorTexture:{width:1024}},roughness:0.4};
 const eames={scene:{meshes:[...Array.from({length:4},(_,i)=>({id:i+1,indices:[0,1,2,0,2,3]})),...Array.from({length:9},(_,i)=>({...mesh,indices:i===0?mesh.indices:[],id:1000+i}))]},evidence:{modelTriangleCount:265468}};
 const room={name:"room",bounds:{min:[-6,-1.44,-4.4],max:[6,1.44,4.4]},primitives:Array.from({length:73},(_,i)=>({...mesh,indices:i===0?new Array(3*3672).fill(0):[]}))};
 const build=(m,options)=>{assert.deepEqual(options.targetCenter,[0,0,0]);assert.equal(options.targetSize,12);return [...Array.from({length:4},(_,i)=>({id:i+1})),...m.primitives];};
 return {room,eames,createProductStudioMeshes:build,lightingOptions:{environmentLighting:{mode:1}}};
}
test("compose original room and Eames without studio or added emitter; preserve identity and floor",()=>{
 const input=inputs(),r=composeRoomEamesScene(input);
 assert.equal(r.scene.meshes.length,82);assert.equal(r.evidence.sceneTriangleCount,269140);
 assert.equal(r.evidence.addedGeometry,0);assert.equal(r.scene.probeDepth,6);
 assert.equal(new Set(r.scene.meshes.map(m=>m.id)).size,82);
 assert.equal(new Set(r.scene.meshes.map(m=>m.materialRefId)).size,82);
 assert.equal(r.scene.meshes[0].positions,input.room.primitives[0].positions);
 assert.equal(r.scene.meshes[73].material,input.eames.scene.meshes[4].material);
 assert.equal(r.scene.meshes[73].indices,input.eames.scene.meshes[4].indices);
 assert.equal(r.evidence.eamesBounds.min[1],ROOM_DEFAULTS.floorY);
 assert.deepEqual(input.eames.scene.meshes[4].positions,triangle);
 assert(Object.isFrozen(ROOM_DEFAULTS));
 assert.equal(r.scene.camera.fovYDegrees,52);
 assert.equal(composeRoomEamesScene({...input,fovYDegrees:62}).scene.camera.fovYDegrees,62);
 assert.throws(()=>composeRoomEamesScene({...input,fovYDegrees:NaN}),/FOV/);
});
test('extra reference models preserve UV1, materials, source scale and all primitives',()=>{
 const input=inputs(),material={sheenColor:[1,0.3,0.1]},asset={bytes:100,sha256:'b'.repeat(64),triangles:1,primitives:1,name:'extra.glb'};
 const extra={bounds:input.room.bounds,primitives:[{positions:[0,0,0,0.2,0,0,0,0.4,0.2],normals:[0,1,0,0,1,0,0,1,0],indices:[0,1,2],uvs1:[0,0,1,0,0,1],material}]};
 const r=composeRoomEamesScene({...input,referenceModels:[{model:extra,asset}]});
 assert.equal(r.scene.meshes.length,83);assert.equal(r.evidence.sceneTriangleCount,269141);assert.equal(r.evidence.referenceModels[0].scale,1);
 assert.equal(r.scene.meshes.at(-1).material,material);assert.equal(r.scene.meshes.at(-1).uvs1,extra.primitives[0].uvs1);
 assert.equal(r.evidence.referenceModels[0].bounds.min[1],ROOM_DEFAULTS.floorY);
 assert.throws(()=>composeRoomEamesScene({...input,referenceModels:[{model:extra,asset:{...asset,triangles:2}}]}),/geometry/);
});
test("rigid Eames yaw rotates positions and normals without rescaling room",()=>{
 const r=composeRoomEamesScene({...inputs(),placement:{x:1,z:-1,yaw:90}});
 assert.deepEqual(r.scene.meshes[73].normals.slice(0,3).map(n=>Math.round(n)),[0,0,-1]);
 const p=r.scene.meshes[73].positions;assert(Math.abs(Math.hypot(p[3]-p[0],p[4]-p[1],p[5]-p[2])-2)<1e-12);
 assert.equal(r.evidence.placement.x,1);
 for(const view of ["entry","front","corner"])assert(composeRoomEamesScene({...inputs(),view}).scene.camera.position.every(Number.isFinite));
});
test("reject invalid placement, unknown view, lost assets or studio strip mismatch",()=>{
 for(const placement of [{x:NaN},{z:Infinity},{yaw:181},{x:50},{z:-50}])assert.throws(()=>composeRoomEamesScene({...inputs(),placement}),/Room reference/);
 assert.throws(()=>composeRoomEamesScene({...inputs(),view:"outside"}),/view/);
 assert.throws(()=>composeRoomEamesScene({...inputs(),room:{primitives:[]}}),/room/);
 assert.throws(()=>composeRoomEamesScene({...inputs(),lightingOptions:{}}),/lighting/);
 assert.throws(()=>composeRoomEamesScene({...inputs(),createProductStudioMeshes:()=>[]}),/studio/);
 const i=inputs();i.eames.scene.meshes[0].id=9;assert.throws(()=>composeRoomEamesScene(i),/studio/);
});
test("room artifact is the exact user-approved binary and standard static glTF",()=>{
 const b=readFileSync(new URL("../demo/eames-environments/assets/finalscene.glb",import.meta.url));
 assert.equal(b.length,ROOM_ASSET.bytes);assert.equal(createHash("sha256").update(b).digest("hex"),ROOM_ASSET.sha256);
 assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 const doc=JSON.parse(b.toString("utf8",20,20+b.readUInt32LE(12)));
 assert.equal(doc.meshes.length,73);assert.equal(doc.cameras?.length??0,0);assert.equal(doc.extensionsRequired?.length??0,0);
 assert.equal(doc.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+doc.accessors[p.indices].count/3,0),0),3672);
});
test("native settings and count admission reject any partial or mislabeled render",()=>{
 for(const resolution of ["1080p","4k"]){
 const s=roomReferenceSettings(resolution,"fixed-pattern");assert.equal(s.maxDepth,6);assert.equal(s.height,resolution==="4k"?2160:1080);
 const plan={totalSamples:95,bands:[{spp:1,pixels:3}]},frame={...s,mode:"radial",diagnostics:true,fused:false,actualSamples:95,actualHistogram:{1:3},validationErrors:0};
 assert.equal(validateRoomFrame(frame,plan,s),true);
 for(const patch of [{actualSamples:0},{width:128},{sampler:"stable-pattern"},{mode:"fixed"},{validationErrors:1},{actualHistogram:{}},{diagnostics:false}])assert.throws(()=>validateRoomFrame({...frame,...patch},plan,s),/Room reference/);
 }
 assert.throws(()=>roomReferenceSettings("720p"),/resolution/);assert.throws(()=>roomReferenceSettings("4k","bad"),/sampler/);
});
test("replacement room admits its own verified counts without changing materials or Eames",()=>{
 const i=inputs(),roomAsset={bytes:100,sha256:'a'.repeat(64),triangles:2,primitives:1};
 i.room.primitives=[{positions:triangle,indices:[0,1,2,0,2,1],material:{roughness:0.9}}];
 const r=composeRoomEamesScene({...i,roomAsset});
 assert.equal(r.evidence.roomTriangleCount,2);assert.equal(r.evidence.sceneTriangleCount,265470);
 assert.equal(r.evidence.sceneMeshes,10);assert.equal(r.scene.meshes[0].material,i.room.primitives[0].material);
 assert.throws(()=>composeRoomEamesScene({...i,roomAsset:{...roomAsset,triangles:3}}),/geometry/);
 assert.throws(()=>composeRoomEamesScene({...i,roomAsset:{...roomAsset,sha256:'bad'}}),/manifest/);
});
