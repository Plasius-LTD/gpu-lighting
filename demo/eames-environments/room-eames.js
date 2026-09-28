// Reference composition only: no new transport, loader or material implementation.
export const ROOM_ASSET=Object.freeze({bytes:651696,sha256:"125331dadb83664e978a8c12cc974bae81bb7b75457e290c6063d921bbe11bc5",triangles:3672,primitives:73});
export const ROOM_DEFAULTS=Object.freeze({x:1.8,z:-1.1,yaw:-25,floorY:-1.3440840244293213,view:"entry"});
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
export function composeRoomEamesScene({room,eames,createProductStudioMeshes,lightingOptions,placement={},view=ROOM_DEFAULTS.view}){
 check(room?.primitives?.length===ROOM_ASSET.primitives,"room primitive count changed");
 check(lightingOptions?.environmentLighting,"lighting missing");
 const bounds=room.bounds;
 check(bounds?.min?.length===3&&bounds?.max?.length===3&&bounds.min.every(Number.isFinite)&&bounds.max.every(Number.isFinite),"room bounds missing");
 const size=bounds.max.map((v,i)=>v-bounds.min[i]);check(size.every(v=>v>0),"invalid room bounds");
 const roomMeshes=sourceMeshes(createProductStudioMeshes(room,{targetCenter:bounds.min.map((v,i)=>(v+bounds.max[i])/2),targetSize:Math.max(...size)}));
 const eamesMeshes=sourceMeshes(eames?.scene?.meshes);
 check(roomMeshes.length===73&&count(roomMeshes)===3672,"room geometry changed");
 check(eamesMeshes.length===9&&count(eamesMeshes)===265468&&eames.evidence.modelTriangleCount===265468,"original Eames required");
 const p={x:placement.x??ROOM_DEFAULTS.x,z:placement.z??ROOM_DEFAULTS.z,yaw:placement.yaw??ROOM_DEFAULTS.yaw};
 check(Object.values(p).every(Number.isFinite)&&Math.abs(p.yaw)<=180,"invalid placement");
 const floorY=ROOM_DEFAULTS.floorY,original=boundsOf(eamesMeshes),cx=(original.min[0]+original.max[0])/2,cz=(original.min[2]+original.max[2])/2;
 const angle=p.yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const rotate=(values,position)=>{
  if(!values)return values;
  const result=new Array(values.length);
  for(let i=0;i<values.length;i+=3){
   const x=values[i]-(position?cx:0),z=values[i+2]-(position?cz:0);
   result[i]=c*x+s*z+(position?p.x:0);
   result[i+1]=values[i+1]+(position?floorY-original.min[1]:0);
   result[i+2]=-s*x+c*z+(position?p.z:0);
  }
  return Object.freeze(result);
 };
 const placed=eamesMeshes.map(m=>({...m,positions:rotate(m.positions,true),normals:rotate(m.normals,false)}));
 const eamesBounds=boundsOf(placed);
 check(eamesBounds.min.every((v,i)=>v>=bounds.min[i])&&eamesBounds.max.every((v,i)=>v<=bounds.max[i]),"placement leaves room bounds");
 const views={entry:[4.55,floorY+1.6,0.95],front:[1.8,floorY+1.6,1.2],corner:[4.7,floorY+1.6,-2.7]};
 check(Object.hasOwn(views,view),"unknown interior view");
 const position=views[view],target=[p.x,floorY+0.85,p.z];
 check(position.every((v,i)=>v>bounds.min[i]&&v<bounds.max[i]),"camera outside room");
 check(Math.hypot(...position.map((v,i)=>v-target[i]))>0.5,"camera too close to target");
 const meshes=[...roomMeshes,...placed].map((m,i)=>Object.freeze({...m,id:i+1,materialRefId:i+1}));
 return {scene:{...lightingOptions,meshes,displayQuality:true,accelerationBuildMode:"cpu-upload",probeDepth:6,camera:{position,target,up:[0,1,0],fovYDegrees:62}},
  evidence:{room:ROOM_ASSET,roomBounds:bounds,roomTriangleCount:3672,eamesTriangleCount:265468,sceneTriangleCount:269140,sceneMeshes:82,
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
