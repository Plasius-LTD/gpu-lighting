import test from "node:test";
import assert from "node:assert/strict";
import {once,EventEmitter} from "node:events";
import http from 'node:http';
import {createRoomReferenceServer} from "../scripts/eames-environments/room-reference-server.mjs";
test("loopback room server serves only committed map assets and unique provenance",async()=>{
 const bridge=new EventEmitter();let captures=0;bridge.on("request",(_req,res)=>{captures++;res.end("retained");});
 const server=createRoomReferenceServer({bodies:new Map([["/room.glb",Buffer.from("model")]]),sources:{renderer:"abc"},bridge});
 server.listen(0,"127.0.0.1");await once(server,"listening");
 try{
  const root="http://127.0.0.1:"+server.address().port;
  const asset=await fetch(root+"/room.glb");assert.equal(asset.headers.get("content-type"),"model/gltf-binary");assert.equal(await asset.text(),"model");
  const a=await(await fetch(root+"/__provenance")).json(),b=await(await fetch(root+"/__provenance")).json();
  assert.notEqual(a.captureId,b.captureId);assert.deepEqual(a.sources,{renderer:"abc"});
  assert.equal(a.source,'immutable-git-objects');
  assert.equal((await fetch(root+'/room.glb',{headers:{origin:'https://foreign.example'}})).status,403);
  const forbidden=await new Promise(resolve=>http.get(root+'/room.glb',{headers:{host:'foreign.example'}},res=>{res.resume();resolve(res.statusCode);}));assert.equal(forbidden,403);
  assert.equal((await fetch(root+"/../../private/file")).status,404);
  assert.equal((await fetch(root+"/room.glb",{method:"DELETE"})).status,405);
  assert.equal(await(await fetch(root+"/room.glb",{method:"HEAD"})).text(),"");
  assert.equal(await(await fetch(root+"/__plasius-capture",{method:"POST",body:"test"})).text(),"retained");assert.equal(captures,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
