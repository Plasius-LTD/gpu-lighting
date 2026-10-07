import test from 'node:test';
import assert from 'node:assert/strict';
import {GLASS_WATER_DEFAULTS,glassWaterSettings,withRoomGlass} from '../demo/eames-environments/glass-water-reference.js';

const composed=()=>({scene:{meshes:[{id:1,positions:[0,0,0],indices:[],material:{name:'preserve'}}],camera:{position:[4,1,2],target:[0,0,0],up:[0,1,0],fovYDegrees:45}},evidence:{floorY:-1,roomBounds:{min:[-6,-1.1,-4],max:[6,2,4]},sceneMeshes:1,sceneTriangleCount:0,addedGeometry:0}});
function volume(mesh){
 const edges=new Map(),p=mesh.positions;let volume=0;
 const key=i=>p.slice(i*3,i*3+3).map(v=>v.toFixed(9)).join(',');
 for(let i=0;i<mesh.indices.length;i+=3){
  const ids=mesh.indices.slice(i,i+3),[a,b,c]=ids.map(j=>p.slice(j*3,j*3+3));
  const ab=b.map((v,j)=>v-a[j]),ac=c.map((v,j)=>v-a[j]);
  const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  assert(Math.hypot(...cross)>1e-12,'degenerate triangle');
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  for(let j=0;j<3;j++){const u=key(ids[j]),v=key(ids[(j+1)%3]),k=[u,v].sort().join('|'),entry=edges.get(k)??[0,0];entry[0]++;entry[1]+=u<v?1:-1;edges.set(k,entry);}
 }
 for(const [count,balance] of edges.values()){assert.equal(count,2,'not manifold');assert.equal(balance,0,'winding mismatch');}
 assert(volume>0,'inward closed volume');return volume;
}
test('glass defaults off, accepts bounded variables, rejects invalid controls',()=>{
 assert.equal(GLASS_WATER_DEFAULTS.mode,'off');
 for(const [key,value] of [['mode','unknown'],['fill',1.1],['fill',NaN],['radius',0],['wall',.2],['segments',3],['segments',64.2],['glassIor',0],['waterIor',Infinity],['x',NaN],['closeup','yes'],['distance',0],['overlap',0]])assert.throws(()=>glassWaterSettings({[key]:value}));
 assert.throws(()=>glassWaterSettings({unexpected:1}));
 assert.equal(glassWaterSettings({mode:'filled',fill:.7}).fill,.7);
});
test('closed outward glass, water and stand preserve correct volume and contact geometry',()=>{
 const c=composed(),r=withRoomGlass(c,{mode:'filled',fill:.5}),e=r.evidence.glassWater,s=e.settings;
 assert.equal(r.scene.meshes.length,4);assert.equal(r.evidence.addedGeometry,e.triangles);
 const [stand,glass,water]=r.scene.meshes.slice(1),fac=s.segments*Math.sin(2*Math.PI/s.segments)/2;
 assert(Math.abs(volume(glass)-fac*(s.radius**2*s.height-(s.radius-s.wall)**2*(s.height-s.base)))<1e-9);
 const h=(s.height-s.base-s.headspace)*s.fill+s.overlap;
 assert(Math.abs(volume(water)-fac*(s.radius-s.wall+s.overlap)**2*h)<1e-9);volume(stand);
 assert.notEqual(glass.mediumRefId,water.mediumRefId);assert.equal(glass.ior,1.5);assert.equal(water.ior,1.333);
 assert(e.overlapMeters>0);assert.equal(e.qualification,'nested-interface-unqualified');
 for(const m of [glass,water]){assert.equal(m.opacity,1);assert.equal(m.transmission,1);assert.equal(m.doubleSided,false);assert.equal(m.materialKind,'dielectric');}
});
test('off is identity, input untouched, empty/zero/full states and camera independently selectable',()=>{
 const c=composed(),before=structuredClone(c);assert.equal(withRoomGlass(c,{}),c);
 const empty=withRoomGlass(c,{mode:'empty'}),zero=withRoomGlass(c,{mode:'filled',fill:0});
 assert.equal(empty.scene.meshes.length,3);assert.equal(zero.scene.meshes.length,3);assert.equal(empty.scene.camera,c.scene.camera);
 const filled=withRoomGlass(c,{mode:'filled',fill:1,closeup:true});
 assert.equal(filled.scene.meshes.length,4);assert.notDeepEqual(filled.scene.camera,c.scene.camera);
 assert.equal(filled.scene.meshes[0],c.scene.meshes[0]);assert.deepEqual(c,before);
 for(const m of filled.scene.meshes.slice(1))volume(m);
 assert.throws(()=>withRoomGlass(c,{mode:'off',closeup:true}),/close-up/);
 assert.throws(()=>withRoomGlass(c,{mode:'empty',x:5.95}),/bounds/);
 assert.throws(()=>withRoomGlass({...c,evidence:{...c.evidence,eamesBounds:{min:[2,-1,-1],max:[4,1,1]}}},{mode:'empty'}),/collision/);
});
