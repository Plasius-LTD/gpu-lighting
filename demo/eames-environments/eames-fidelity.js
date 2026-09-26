// Representative admission is deliberately specific to the original site Eames asset.
// It does not turn a renderer-only screen into application/display qualification.
const triangles=[84332,19664,45580,21176,69936,9664,11404,3456,256];
const textureRoles={1:["baseColorTexture","normalTexture"],2:["baseColorTexture","normalTexture","metallicRoughnessTexture"],
  5:["baseColorTexture","normalTexture"],6:["baseColorTexture","normalTexture","metallicRoughnessTexture"]};
const requireValue=(value,message)=>{if(!value)throw new Error("Eames fidelity admission: "+message);};
export function createEamesTraceScene(model,{createProductStudioMeshes,lightingOptions}){
  requireValue(model?.name==="Eames_Lounge_Chair_Ottoman","wrong model identity");
  requireValue(model.primitives?.length===9,"original nine primitives required");
  const textureSlots=[];
  model.primitives.forEach((p,i)=>{
    requireValue(p.indices?.length===triangles[i]*3,"source triangle count changed");
    requireValue(p.positions?.length>=9&&p.normals?.length===p.positions.length&&p.uvs?.length===p.positions.length/3*2,"normals/UVs missing");
    for(const role of textureRoles[i]??[]){
      const t=p.material?.[role];
      requireValue(t?.width===1024&&t.height===1024&&t.data?.length===1024*1024*4,"original 1024-square texture missing/reduced");
      textureSlots.push({primitive:i,role,width:t.width,height:t.height});
    }
  });
  for(const i of [3,7])requireValue(model.primitives[i].material?.metallic===1,"chrome glTF metalness default lost");
  for(const i of [1,2,5,6]){
    const color=model.primitives[i].material?.color;
    requireValue(color?.r===1&&color.g===1&&color.b===1&&color.a===1,"textured glTF color default lost");
  }
  const meshes=createProductStudioMeshes(model),triangleCount=meshes.reduce((n,m)=>n+m.indices.length/3,0);
  requireValue(meshes.length===13&&triangleCount===265476,"Product Studio geometry changed");
  requireValue(lightingOptions?.environmentLighting,"lighting missing");
  for(let i=0;i<9;i++){
    const m=meshes[i+4],p=model.primitives[i];
    requireValue(m.indices.length===p.indices.length&&m.normals?.length===p.normals.length&&m.uvs?.length===p.uvs.length,"submitted attributes missing");
    for(const role of textureRoles[i]??[])requireValue(m.material?.[role]===p.material[role],"submitted texture changed");
  }
  return {
    scene:{...lightingOptions,meshes,displayQuality:true,accelerationBuildMode:"cpu-upload",probeDepth:4,
      camera:{position:[0,1.12,5.05],target:[0,0.72,0],up:[0,1,0],fovYDegrees:43}},
    evidence:{modelName:model.name,assetTier:"source",modelTriangleCount:265468,sceneTriangleCount:triangleCount,
      modelPrimitives:9,sceneMeshes:13,sourceMaterials:5,sourceTextures:5,textureSlots,
      environment:"product-studio",geometry:"mesh-bvh",proxyGeometry:false,renderScope:"renderer-pipeline-not-site-application"}
  };
}
export function assertEamesRendererAdmission(snapshot){
  requireValue(snapshot?.displayQuality===true&&snapshot.accelerationBuildMode==="cpu-upload","mesh display path missing");
  requireValue(snapshot.triangleCount===265476&&snapshot.bvhNodeCount>0,"GPU scene geometry mismatch");
  requireValue(snapshot.maxDepth===4&&snapshot.samplesPerPixel===32,"fixed scene ceiling changed");
  return snapshot;
}

