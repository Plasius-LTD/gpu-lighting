// Reference composition only: no new transport, loader or material implementation.
export const ROOM_ASSET=Object.freeze({bytes:651696,sha256:"125331dadb83664e978a8c12cc974bae81bb7b75457e290c6063d921bbe11bc5",triangles:3672,primitives:73});
export const ROOM_DEFAULTS=Object.freeze({x:2.3,z:-2.5,yaw:-25,floorY:-1.3440840244293213,view:"entry",fovYDegrees:52});
const check=(v,m)=>{if(!v)throw new Error("Room reference: "+m);};
const count=meshes=>meshes.reduce((n,m)=>n+m.indices.length/3,0);
function sourceMeshes(meshes){
 check(Array.isArray(meshes)&&meshes.length>4&&[1,2,3,4].every((id,i)=>meshes[i].id===id),"studio prefix changed");
 return meshes.slice(4);
}
function boundsOf(meshes){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const mesh of meshes)for(let i=0;i<mesh.positions.length;i++){
  const v=mesh.positions[i];check(Number.isFinite(v),"non-finite geometry");
  min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);
 }
 check(min.every(Number.isFinite),"empty geometry");return {min,max};
}
function placeOnFloor(meshes,p,floorY,scale=1){
 check(Number.isFinite(scale)&&scale>0,'invalid uniform scale');
 const original=boundsOf(meshes),cx=(original.min[0]+original.max[0])/2,cz=(original.min[2]+original.max[2])/2;
 const angle=p.yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const rotate=(values,position)=>{
  if(!values)return values;
  const result=new Array(values.length);
  for(let i=0;i<values.length;i+=3){
   const x=position?(values[i]-cx)*scale:values[i],z=position?(values[i+2]-cz)*scale:values[i+2];
   result[i]=c*x+s*z+(position?p.x:0);
   result[i+1]=position?(values[i+1]-original.min[1])*scale+floorY:values[i+1];
   result[i+2]=-s*x+c*z+(position?p.z:0);
  }
  return Object.freeze(result);
 };
 return meshes.map(m=>({...m,positions:rotate(m.positions,true),normals:rotate(m.normals,false)}));
}
export function composeRoomEamesScene({room,eames,createProductStudioMeshes,lightingOptions,placement={},view=ROOM_DEFAULTS.view,roomAsset=ROOM_ASSET,referenceModels=[],fovYDegrees=ROOM_DEFAULTS.fovYDegrees}){
 check(Number.isFinite(fovYDegrees)&&fovYDegrees>=40&&fovYDegrees<=80,'FOV must be between 40 and 80 degrees');
 check(Array.isArray(referenceModels)&&referenceModels.length<=2,'at most two reference models');
 check(Number.isInteger(roomAsset?.bytes)&&roomAsset.bytes>0&&/^[a-f0-9]{64}$/.test(roomAsset.sha256)&&Number.isInteger(roomAsset.triangles)&&roomAsset.triangles>0&&Number.isInteger(roomAsset.primitives)&&roomAsset.primitives>0,"invalid room manifest");
 check(room?.primitives?.length===roomAsset.primitives,"room primitive count changed");
 check(lightingOptions?.environmentLighting,"lighting missing");
 const bounds=room.bounds;
 check(bounds?.min?.length===3&&bounds?.max?.length===3&&bounds.min.every(Number.isFinite)&&bounds.max.every(Number.isFinite),"room bounds missing");
 const size=bounds.max.map((v,i)=>v-bounds.min[i]);check(size.every(v=>v>0)&&Math.max(...size)>=0.25,"invalid room bounds");
 const roomMeshes=sourceMeshes(createProductStudioMeshes(room,{targetCenter:bounds.min.map((v,i)=>(v+bounds.max[i])/2),targetSize:Math.max(...size)}));
 const eamesMeshes=sourceMeshes(eames?.scene?.meshes);
 check(roomMeshes.length===roomAsset.primitives&&count(roomMeshes)===roomAsset.triangles,"room geometry changed");
 check(eamesMeshes.length===9&&count(eamesMeshes)===265468&&eames.evidence.modelTriangleCount===265468,"original Eames required");
 const p={x:placement.x??ROOM_DEFAULTS.x,z:placement.z??ROOM_DEFAULTS.z,yaw:placement.yaw??ROOM_DEFAULTS.yaw};
 check(Object.values(p).every(Number.isFinite)&&Math.abs(p.yaw)<=180,"invalid placement");
 const floorY=ROOM_DEFAULTS.floorY,placed=placeOnFloor(eamesMeshes,p,floorY);
 const eamesBounds=boundsOf(placed);
 check(eamesBounds.min.every((v,i)=>v>=bounds.min[i])&&eamesBounds.max.every((v,i)=>v<=bounds.max[i]),"placement leaves room bounds");
 const extras=referenceModels.map(({model,asset},i)=>{
  const b=model.bounds,extent=b.max.map((v,j)=>v-b.min[j]);
  check(extent.every(v=>Number.isFinite(v)&&v>0)&&Math.max(...extent)>=0.25,'invalid reference model bounds');
  const source=sourceMeshes(createProductStudioMeshes(model,{targetCenter:b.min.map((v,j)=>(v+b.max[j])/2),targetSize:Math.max(...extent)}));
  check(source.length===asset.primitives&&count(source)===asset.triangles,'reference model geometry changed');
  const sourceBounds=boundsOf(source),sourceDimensions=sourceBounds.max.map((v,j)=>v-sourceBounds.min[j]);
  check(sourceDimensions[0]>0,'reference model width must be positive');
  // User-requested local size override: preserve every proportion, not just width.
  const scale=i===0?2.1/sourceDimensions[0]:1,displayDimensions=sourceDimensions.map(v=>v*scale);
  const placement=i===0?{x:0.35,z:0.2,yaw:45}:{x:1.8,z:-1.1,yaw:40};
  const meshes=placeOnFloor(source,placement,floorY,scale),placedBounds=boundsOf(meshes);
  check(placedBounds.min.every((v,j)=>v>=bounds.min[j])&&placedBounds.max.every((v,j)=>v<=bounds.max[j]),'reference model leaves room bounds');
  return {meshes,evidence:{asset,placement,bounds:placedBounds,sourceBounds,sourceDimensions,displayDimensions,scale,
   scaleReason:i===0?'user-requested-proportional-two-seater-size':'authored-scale',
   materials:model.primitives.map(m=>({name:m.material?.name,hasUv1:!!m.uvs1,sheenColor:m.material?.sheenColor,
    textureUvSets:Object.fromEntries(Object.entries(m.material??{}).filter(([key,v])=>key.endsWith('Texture')&&v).map(([key,v])=>[key,v.texCoord??0]))}))}};
 });
 const views={entry:[4.55,floorY+1.6,0.95],front:[1.8,floorY+1.6,1.2],corner:[4.7,floorY+1.6,-2.7]};
 check(Object.hasOwn(views,view),"unknown interior view");
 // Preserve the comparison camera while subjects exchange their floor positions.
 const position=views[view],target=[1.8,floorY+0.85,-1.1];
 check(position.every((v,i)=>v>bounds.min[i]&&v<bounds.max[i]),"camera outside room");
 check(Math.hypot(...position.map((v,i)=>v-target[i]))>0.5,"camera too close to target");
 const meshes=[...roomMeshes,...placed,...extras.flatMap(e=>e.meshes)].map((m,i)=>Object.freeze({...m,id:i+1,materialRefId:i+1}));
 return {scene:{...lightingOptions,meshes,displayQuality:true,accelerationBuildMode:"cpu-upload",probeDepth:6,camera:{position,target,up:[0,1,0],fovYDegrees}},
  evidence:{room:roomAsset,roomBounds:bounds,roomTriangleCount:roomAsset.triangles,eamesTriangleCount:265468,sceneTriangleCount:count(meshes),sceneMeshes:meshes.length,referenceModels:extras.map(e=>e.evidence),camera:{position,target,fovYDegrees},
   placement:p,eamesBounds,view,floorY,addedGeometry:0,lighting:"external-daylight-no-added-emitter",geometry:"mesh-bvh",proxyGeometry:false,
   interaction:"placement-and-camera-between-renders-not-realtime-or-collision-qualified"}};
}
export function roomReferenceSettings(resolution="1080p",sampler="fixed-pattern"){
 check(["1080p","4k"].includes(resolution),"unknown resolution");
 check(["fixed-pattern","stable-pattern"].includes(sampler),"unknown sampler");
 return Object.freeze({width:resolution==="4k"?3840:1920,height:resolution==="4k"?2160:1080,maxDepth:6,maximumSpp:32,sampler,denoise:false});
}
export function validateRoomFrame(frame,plan,settings){
 const canonical=roomReferenceSettings(settings.width===3840?"4k":"1080p",settings.sampler);
 check(Object.entries(canonical).every(([key,value])=>settings[key]===value),"settings changed");
 check(frame.width===settings.width&&frame.height===settings.height&&frame.sampler===settings.sampler&&frame.mode==="radial","frame identity changed");
 check(frame.diagnostics===true&&frame.fused===false&&frame.validationErrors===0,"invalid diagnostic frame");
 check(frame.actualSamples===plan.totalSamples,"completed samples mismatch");
 for(const band of plan.bands)check(frame.actualHistogram?.[band.spp]===band.pixels,"completed histogram mismatch");
 return true;
}
