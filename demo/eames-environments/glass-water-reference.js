// Original parametric reference geometry, not a second material/transport model.
export const GLASS_WATER_DEFAULTS=Object.freeze({mode:'off',fill:.55,x:2.85,z:-.1,
 radius:.055,height:.18,wall:.004,base:.012,headspace:.003,overlap:.0002,segments:96,
 standHeight:.65,standRadius:.18,glassIor:1.5,waterIor:1.333,closeup:false,distance:.45,elevation:25});
const check=(v,m)=>{if(!v)throw Error('Glass reference: '+m);};
export function glassWaterSettings(input={}){
 check(input&&typeof input==='object'&&!Array.isArray(input),'invalid settings');
 check(Object.keys(input).every(k=>Object.hasOwn(GLASS_WATER_DEFAULTS,k)),'unknown setting');
 const s={...GLASS_WATER_DEFAULTS,...input};
 check(['off','empty','filled'].includes(s.mode),'unknown mode');check(typeof s.closeup==='boolean','invalid close-up');
 const ranges={fill:[0,1],x:[-6,6],z:[-4,4],radius:[.025,.12],height:[.06,.4],wall:[.001,.02],base:[.003,.04],headspace:[.001,.02],overlap:[.00001,.0005],segments:[24,256],standHeight:[.2,1.2],standRadius:[.12,.4],glassIor:[1,2.5],waterIor:[1,2.5],distance:[.3,3],elevation:[5,85]};
 for(const [k,[min,max]] of Object.entries(ranges))check(Number.isFinite(s[k])&&s[k]>=min&&s[k]<=max,'invalid '+k);
 check(Number.isInteger(s.segments),'segments must be integer');
 check(s.wall<s.radius/3&&s.base+s.headspace<s.height/2&&s.overlap<s.wall/3&&s.standRadius>s.radius,'invalid wall/base/contact dimensions');
 check(!s.closeup||s.mode!=='off','close-up requires glass');return Object.freeze(s);
}
function lathe(profile,segments,origin){
 const positions=[],normals=[],indices=[];
 for(let j=0;j<profile.length-1;j++){
  const [r0,y0]=profile[j],[r1,y1]=profile[j+1],dr=r1-r0,dy=y1-y0,len=Math.hypot(dr,dy);
  for(let i=0;i<segments;i++){
   const t=i*2*Math.PI/segments,u=((i+1)%segments)*2*Math.PI/segments;
   const p=(r,y,a)=>[origin[0]+r*Math.cos(a),origin[1]+y,origin[2]+r*Math.sin(a)];
   const n=a=>[dy/len*Math.cos(a),-dr/len,dy/len*Math.sin(a)];
   const points=[p(r0,y0,t),p(r1,y1,t),p(r1,y1,u),p(r0,y0,u)],ns=[n(t),n(t),n(u),n(u)];
   // Axis caps have only one nondegenerate triangle; preserve hard profile edges.
   for(const tri of [[0,1,2],[0,2,3]]){
    if((r1===0&&tri[1]===1)||(r0===0&&tri[1]===2))continue;
    for(const k of tri){indices.push(positions.length/3);positions.push(...points[k]);normals.push(...ns[k]);}
   }
  }
 }
 return {positions,normals,indices};
}
const intersects=(a,b)=>a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);
export function withRoomGlass(composed,selection={}){
 const s=glassWaterSettings(selection);if(s.mode==='off')return composed;
 const e=composed.evidence,scene=composed.scene,floor=e.floorY;
 check(Number.isFinite(floor)&&scene?.meshes&&e.roomBounds,'missing room composition');
 const bounds={min:[s.x-s.standRadius,floor,s.z-s.standRadius],max:[s.x+s.standRadius,floor+s.standHeight+s.height,s.z+s.standRadius]};
 check(bounds.min.every((v,i)=>v>=e.roomBounds.min[i]&&bounds.max[i]<=e.roomBounds.max[i]),'glass/support outside room bounds');
 for(const b of [e.eamesBounds,...(e.referenceModels??[]).map(r=>r.bounds)].filter(Boolean))check(!intersects(bounds,b),'glass/support collision with reference model');
 const ids=scene.meshes.flatMap(m=>[m.id,m.materialRefId,m.mediumRefId,m.medium?.id,m.material?.mediumId]).concat((scene.mediums??[]).map(m=>m.id)).filter(Number.isSafeInteger);
 const start=Math.max(scene.meshes.length,0,...ids)+1;
 check(start+3<65536,'reference identity budget exceeded');
 const origin=[s.x,floor+s.standHeight,s.z],inner=s.radius-s.wall;
 const make=(profile,offset,material,at=origin)=>({...lathe(profile,s.segments,at),...material,id:start+offset,materialRefId:start+offset,doubleSided:false});
 const stand=make([[0,0],[s.standRadius,0],[s.standRadius,s.standHeight],[0,s.standHeight]],0,{materialKind:'diffuse',color:[.35,.35,.35,1],roughness:.8,metallic:0},[s.x,floor,s.z]);
 const dielectric=(ior,id)=>({materialKind:'dielectric',color:[1,1,1,1],roughness:0,metallic:0,specularWeight:1,opacity:1,transmission:1,ior,mediumRefId:id,medium:{id,absorption:[0,0,0],scattering:[0,0,0]}});
 const glass=make([[0,0],[s.radius,0],[s.radius,s.height],[inner,s.height],[inner,s.base],[0,s.base]],1,dielectric(s.glassIor,start+1));
 const added=[stand,glass],waterY=s.base+(s.height-s.base-s.headspace)*s.fill;
 if(s.mode==='filled'&&s.fill>0)added.push(make([[0,s.base-s.overlap],[inner+s.overlap,s.base-s.overlap],[inner+s.overlap,waterY],[0,waterY]],2,dielectric(s.waterIor,start+2)));
 const triangles=added.reduce((sum,m)=>sum+m.indices.length/3,0),target=[s.x,origin[1]+s.height*.5,s.z];
 const angle=s.elevation*Math.PI/180,yaw=Math.atan2(scene.camera.position[0]-scene.camera.target[0],scene.camera.position[2]-scene.camera.target[2]);
 const direction=[Math.sin(yaw)*Math.cos(angle),Math.sin(angle),Math.cos(yaw)*Math.cos(angle)];
 const camera=s.closeup?{...scene.camera,position:target.map((v,i)=>v+s.distance*direction[i]),target,up:[0,1,0]}:scene.camera;
 if(s.closeup)check(camera.position.every((v,i)=>v>e.roomBounds.min[i]&&v<e.roomBounds.max[i]),'close-up camera outside room bounds');
 return {scene:{...scene,camera,meshes:[...scene.meshes,...added]},evidence:{...e,camera,sceneMeshes:scene.meshes.length+added.length,sceneTriangleCount:e.sceneTriangleCount+triangles,addedGeometry:(e.addedGeometry??0)+triangles,
  glassWater:{settings:s,triangles,bounds,waterSurfaceY:s.mode==='filled'&&s.fill>0?origin[1]+waterY:null,overlapMeters:s.overlap,mediumIds:{glass:start+1,water:s.mode==='filled'&&s.fill>0?start+2:null},
   source:'original-parametric-geometry',qualification:'nested-interface-unqualified',limitation:'Current renderer assumes air-relative refraction; overlapping glass/water requires separate transport qualification. No liquid dynamics or caustic convergence claim.'}}};
}
