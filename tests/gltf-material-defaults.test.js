import assert from "node:assert/strict";
import test from "node:test";
import {loadEamesGltfModel} from "../demo/eames-environments/eames-loader.js";

async function loadMaterial(material) {
  const positions = new Float32Array([0,0,0,1,0,0,0,1,0]);
  const document = {asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],
    nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},...(material===undefined?{}:{material:0})}]}],
    ...(material===undefined?{}:{materials:[material]}),
    buffers:[{uri:"mesh.bin",byteLength:positions.byteLength}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3"}]};
  const original=globalThis.fetch;
  globalThis.fetch=async url=>String(url).endsWith("mesh.bin")
    ? {ok:true,arrayBuffer:async()=>positions.buffer}
    : {ok:true,url:"https://example.test/eames/model.gltf",json:async()=>document};
  try {return await loadEamesGltfModel("https://example.test/eames/model.gltf");}
  finally {globalThis.fetch=original;}
}

for (const [name,material] of [["absent material",undefined],["absent PBR",{}],["empty PBR",{pbrMetallicRoughness:{}}]]) {
  test("glTF omission defaults are white / metallic one / roughness one: "+name,async()=>{
    const model=await loadMaterial(material),m=model.primitives[0].material;
    assert.deepEqual(m.color,{r:1,g:1,b:1,a:1});
    assert.equal(m.metallic,1);assert.equal(m.roughness,1);
  });
}
test("explicit zero and nonzero glTF factors are preserved",async()=>{
  for(const [color,metallic,roughness] of [[[0,0,0,0],0,0],[[0.2,0.4,0.6,0.8],0.7,0.3]]){
    const model=await loadMaterial({pbrMetallicRoughness:{baseColorFactor:color,metallicFactor:metallic,roughnessFactor:roughness}});
    const m=model.primitives[0].material;
    assert.deepEqual(m.color,{r:color[0],g:color[1],b:color[2],a:color[3]});
    assert.equal(m.metallic,metallic);assert.equal(m.roughness,roughness);
  }
});
test("Eames chrome uses glTF default metalness and preserves specular tint",async()=>{
  const model=await loadMaterial({name:"Eames_Lounge_Chair_Ottoman_Chrome_",
    pbrMetallicRoughness:{baseColorFactor:[0.5556,0.5545,0.5548,1],roughnessFactor:0.03},
    extensions:{KHR_materials_specular:{specularColorFactor:[0.57,0.557,0.689]}}});
  const m=model.primitives[0].material;
  assert.equal(m.metallic,1);assert.equal(m.roughness,0.03);
  assert.deepEqual(m.specularColor,[0.57,0.557,0.689]);
  
});

