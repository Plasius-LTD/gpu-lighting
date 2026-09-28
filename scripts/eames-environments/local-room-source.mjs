import {createHash} from 'node:crypto';

const check=(value,message)=>{if(!value)throw new Error('Local room: '+message);};
// Admission only. Geometry, transforms, materials and texture decoding remain in gpu-shared.
export function inspectLocalRoomGlb(bytes,name,{referenceModel=false}={}){
 check(Buffer.isBuffer(bytes)&&bytes.length>=20&&bytes.length<=128*1024*1024,'GLB size outside bounds');
 check(bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(4)===2&&bytes.readUInt32LE(8)===bytes.length,'invalid GLB header');
 let offset=12,document,binSeen=false;
 while(offset<bytes.length){
  check(offset+8<=bytes.length,'truncated chunk');
  const size=bytes.readUInt32LE(offset),kind=bytes.readUInt32LE(offset+4);offset+=8;
  check(size%4===0&&offset+size<=bytes.length,'invalid chunk length');
  if(kind===0x4e4f534a){check(!document&&offset===20,'invalid JSON chunk');document=JSON.parse(bytes.toString('utf8',offset,offset+size));}
  else {check(document&&!binSeen&&kind===0x004e4942,'unsupported chunk');binSeen=true;}
  offset+=size;
 }
 check(document?.asset?.version==='2.0','unsupported glTF version');
 const supported=referenceModel?['KHR_texture_transform','KHR_materials_sheen','KHR_materials_variants']:[];
 check([...(document.extensionsRequired??[]),...(document.extensionsUsed??[])].every(name=>supported.includes(name)),'extensions require separate qualification');
 check(!document.animations?.length&&!document.skins?.length,'animated/skinned models unsupported');
 for(const resource of [...document.buffers??[],...document.images??[]])check(resource.uri===undefined,'external or inline URI resources unsupported; embed in BIN');
 let triangles=0,primitives=0,nodes=0;
 function visit(index,ancestors=new Set()){
  check(Number.isInteger(index)&&!ancestors.has(index)&&++nodes<=10000,'invalid/cyclic scene graph');
  const node=document.nodes?.[index];check(node,'missing scene node');
  const next=new Set(ancestors).add(index);
  if(node.mesh!==undefined){
   const mesh=document.meshes?.[node.mesh];check(mesh?.primitives?.length,'missing mesh');
   for(const p of mesh.primitives){
    check((p.mode??4)===4&&!p.targets?.length,'only static triangles supported');
    const count=document.accessors?.[p.indices??p.attributes?.POSITION]?.count;
    check(Number.isInteger(count)&&count>0&&count%3===0,'invalid triangle accessor');
    triangles+=count/3;primitives++;
   }
  }
  for(const child of node.children??[])visit(child,next);
 }
 const scene=document.scenes?.[document.scene??0];check(scene?.nodes?.length,'empty scene');
 for(const root of scene.nodes)visit(root);
 check(primitives>0&&triangles<=2000000,'geometry outside reference limits');
 check(typeof name==='string'&&name.length>0&&name.length<=160&&!/[\\/]/.test(name)&&[...name].every(c=>c.charCodeAt(0)>=32),'invalid display name');
 return Object.freeze({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),triangles,primitives,embeddedImages:document.images?.length??0,extensionsUsed:document.extensionsUsed??[],materialVariant:'default',publication:'local-only-not-approved-for-publication'});
}
export function addLocalRoomSnapshot(snapshot,input,name){
 const bytes=Buffer.from(input),room=inspectLocalRoomGlb(bytes,name),bodies=new Map(snapshot.bodies);
 bodies.set('/__room-model.glb',bytes);bodies.set('/__room-manifest.json',Buffer.from(JSON.stringify(room)));
 return {...snapshot,bodies,source:'immutable-git-code-and-local-asset-snapshot',assets:{...snapshot.assets,room}};
}
export function addLocalReferenceModels(snapshot,inputs){
 check(Array.isArray(inputs)&&inputs.length<=2,'at most two reference models are supported');
 const bodies=new Map(snapshot.bodies),models=inputs.map(({bytes:input,name},i)=>{
  const bytes=Buffer.from(input),asset=inspectLocalRoomGlb(bytes,name,{referenceModel:true});
  bodies.set(`/__reference-model-${i}.glb`,bytes);return asset;
 });
 bodies.set('/__reference-models.json',Buffer.from(JSON.stringify(models)));
 return {...snapshot,bodies,source:inputs.length?'immutable-git-code-and-local-asset-snapshot':snapshot.source,assets:{...snapshot.assets,models}};
}
