import http from "node:http";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
import {createCaptureBridgeServer} from "./capture-bridge-server.mjs";
import {addLocalRoomSnapshot,addLocalReferenceModels} from "./local-room-source.mjs";
import {ROOM_ASSET} from "../../demo/eames-environments/room-eames.js";

const types={".html":"text/html; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".glb":"model/gltf-binary",".gltf":"model/gltf+json",".bin":"application/octet-stream"};
export function createRoomReferenceServer({bodies,sources,source="immutable-git-objects",assets,bridge=createCaptureBridgeServer()}){
 return http.createServer((req,res)=>{
  // Private local assets must not become readable through DNS rebinding/cross-origin requests.
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??'')||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)){res.writeHead(403);res.end('Loopback same-origin access required');return;}
  let url;try{url=new URL(req.url,"http://127.0.0.1");}catch{res.writeHead(400);res.end("Invalid URL");return;}
  if(req.method==="POST"&&url.pathname==="/__plasius-capture"){bridge.emit("request",req,res);return;}
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);res.end();return;}
  const body=url.pathname==="/__provenance"?Buffer.from(JSON.stringify({sources,source,assets,captureId:"room-reference-"+new Date().toISOString().replaceAll(":","-").replaceAll(".","-")+"-"+randomUUID()})):bodies.get(url.pathname);
  if(!body){res.writeHead(404);res.end("Not found");return;}
  res.writeHead(200,{"Content-Type":url.pathname==="/__provenance"?"application/json":types[path.extname(url.pathname)]??"text/javascript; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(req.method==="HEAD"?undefined:body);
 });
}
export function loadCommittedRoomSources(roots){
 const git=(name,...args)=>execFileSync("git",args,{cwd:roots[name],maxBuffer:32*1024*1024});
 const sources={},bodies=new Map();
 for(const name of ["renderer","lighting","shared"]){
  if(git(name,"status","--porcelain").length)throw new Error(name+" checkout must be clean before capture");
  sources[name]=git(name,"rev-parse","HEAD").toString().trim();
 }
 for(const [name,prefix,folders] of [["renderer","",["src","tests/fixtures"]],["lighting","/lighting",["src","demo/eames-environments"]],["shared","/shared",["src"]]]){
  for(const file of git(name,"ls-tree","-rz","--name-only",sources[name],...folders).toString().split("\0").filter(p=>/\.(js|mjs|html|json|glb)$/.test(p)))
   bodies.set(prefix+"/"+file,git(name,"show",sources[name]+":"+file));
 }
 const manifest=JSON.parse(bodies.get("/lighting/demo/eames-environments/eames-source-manifest.json"));sources.site=manifest.siteCommit;
 for(const file of manifest.files)bodies.set("/eames/"+file.name,git("site","show",sources.site+":"+manifest.sourceDirectory+file.name));
 if(!bodies.has("/tests/fixtures/native-room-reference.html")||!bodies.has("/lighting/demo/eames-environments/assets/finalscene.glb"))throw new Error("Room reference commits are missing");
 bodies.set('/__room-model.glb',bodies.get('/lighting/demo/eames-environments/assets/finalscene.glb'));
 bodies.set('/__room-manifest.json',Buffer.from(JSON.stringify({...ROOM_ASSET,name:'finalscene.glb',publication:'public-user-approved'})));
 bodies.set('/__reference-models.json',Buffer.from('[]'));
 return {bodies,sources};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [renderer,shared,site,portValue="5209",localRoom,...referenceModels]=process.argv.slice(2),port=Number(portValue);
 if(!renderer||!shared||!site||!Number.isInteger(port)||port<1024||port>65535)throw new Error("Usage: node room-reference-server.mjs RENDERER_ROOT SHARED_ROOT SITE_ROOT [PORT] [LOCAL_ROOM_GLB]");
 const lighting=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");let snapshot=loadCommittedRoomSources({renderer,lighting,shared,site});
 const localBytes=file=>{const s=statSync(file);if(!s.isFile()||s.size>128*1024*1024)throw Error('Local model must be a GLB file under 128 MiB');return readFileSync(file);};
 if(localRoom&&localRoom!=='-')snapshot=addLocalRoomSnapshot(snapshot,localBytes(localRoom),path.basename(localRoom));
 if(referenceModels.length>2)throw Error('At most two additional reference models are supported');
 snapshot=addLocalReferenceModels(snapshot,referenceModels.map(file=>({bytes:localBytes(file),name:path.basename(file)})));
 createRoomReferenceServer(snapshot).listen(port,"127.0.0.1",()=>console.log(JSON.stringify({url:`http://127.0.0.1:${port}/tests/fixtures/native-room-reference.html`,sources:snapshot.sources})));
}
