import assert from "node:assert/strict";
import test from "node:test";
import {createEamesTraceScene,assertEamesRendererAdmission} from "../demo/eames-environments/eames-fidelity.js";
const pixels=new Uint8Array(1024*1024*4),counts=[84332,19664,45580,21176,69936,9664,11404,3456,256];
function fixture(){
 const material={color:{r:1,g:1,b:1,a:1},metallic:1,...Object.fromEntries(["baseColorTexture","normalTexture","metallicRoughnessTexture"].map(k=>[k,{width:1024,height:1024,data:pixels}]))};
 const model={name:"Eames_Lounge_Chair_Ottoman",primitives:counts.map(n=>({indices:new Array(n*3).fill(0),positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[0,0,1,0,0,1],material}))};
 const options={createProductStudioMeshes:m=>[...[0,1,2,3].map(()=>({indices:[0,1,2,0,2,3]})),...m.primitives],lightingOptions:{environmentLighting:{mode:1}}};
 return {model,options};
}
test("source Eames admission preserves native geometry, original textures and Product Studio scene",()=>{
 const {model,options}=fixture(),result=createEamesTraceScene(model,options);
 assert.equal(result.evidence.modelTriangleCount,265468);assert.equal(result.evidence.sceneTriangleCount,265476);
 assert.equal(result.evidence.textureSlots.length,10);assert.equal(result.scene.meshes.length,13);
 assert.equal(result.scene.displayQuality,true);assert.equal(result.scene.probeDepth,4);
 assert.equal(result.evidence.renderScope,"renderer-pipeline-not-site-application");
});
test("reject substituted, reduced or incomplete Eames input",()=>{
 const {model,options}=fixture();
 for(const changed of [{...model,name:"brigantine"},{...model,primitives:[]},
 {...model,primitives:model.primitives.map((p,i)=>i===0?{...p,indices:[]}:p)},
 {...model,primitives:model.primitives.map((p,i)=>i===0?{...p,normals:null}:p)},
 {...model,primitives:model.primitives.map(p=>({...p,material:{...p.material,normalTexture:null}}))},
 {...model,primitives:model.primitives.map(p=>({...p,material:{...p.material,metallic:0.08}}))},
 {...model,primitives:model.primitives.map(p=>({...p,material:{...p.material,color:{r:0.56,g:0.33,b:0.22,a:1}}}))}
 ]) assert.throws(()=>createEamesTraceScene(changed,options),/fidelity admission/);
 assert.throws(()=>createEamesTraceScene(model,{...options,createProductStudioMeshes:()=>[]}),/geometry changed/);
 assert.throws(()=>createEamesTraceScene(model,{...options,lightingOptions:{}}),/lighting missing/);
 assert.throws(()=>createEamesTraceScene(model,{...options,createProductStudioMeshes:m=>options.createProductStudioMeshes(m).map((p,i)=>i===4?{...p,uvs:null}:p)}),/attributes missing/);
 assert.throws(()=>createEamesTraceScene(model,{...options,createProductStudioMeshes:m=>options.createProductStudioMeshes(m).map((p,i)=>i===5?{...p,material:{}}:p)}),/texture changed/);
});
test("GPU scene admission requires source triangles, BVH and unchanged fidelity ceiling",()=>{
 const good={displayQuality:true,accelerationBuildMode:"cpu-upload",triangleCount:265476,bvhNodeCount:100,maxDepth:4,samplesPerPixel:32};
 assert.equal(assertEamesRendererAdmission(good),good);
 for(const changed of [null,{...good,displayQuality:false},{...good,triangleCount:6},{...good,bvhNodeCount:0},{...good,maxDepth:1},{...good,samplesPerPixel:1}])
 assert.throws(()=>assertEamesRendererAdmission(changed),/fidelity admission/);
});

