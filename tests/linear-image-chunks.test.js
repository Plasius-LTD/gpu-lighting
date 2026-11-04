import test from "node:test";
import assert from "node:assert/strict";
import { encodeLinearImageChunks } from "../demo/eames-environments/linear-image-chunks.js";

test("bounded image chunks preserve every HDR float bit through byte-plane compression",async()=>{
  const image=new Float32Array(4096);for(let i=0;i<image.length;i++)image[i]=i%4===3?1:Math.sin(i)**2*100;
  const restored=new Uint8Array(image.byteLength);let count=0;
  for await(const chunk of encodeLinearImageChunks(image,{chunkBytes:1024})){
    assert.ok(chunk.byteLength<=1024);assert.equal(chunk.totalBytes,image.byteLength);
    const bytes=Uint8Array.from(atob(chunk.data),c=>c.charCodeAt(0));
    const shuffled=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    const raw=new Uint8Array(chunk.byteLength),n=raw.length/4;
    for(let plane=0;plane<4;plane++)for(let i=0;i<n;i++)raw[4*i+plane]=shuffled[plane*n+i];
    const digest=Buffer.from(await crypto.subtle.digest("SHA-256",raw)).toString("hex");
    assert.equal(digest,chunk.sha256);restored.set(raw,chunk.byteOffset);count++;
  }
  assert.equal(count,16);assert.deepEqual(restored,new Uint8Array(image.buffer));
  const sub=image.subarray(4,12),chunks=[];
  for await(const c of encodeLinearImageChunks(sub))chunks.push(c);
  assert.equal(chunks.length,1);assert.equal(chunks[0].byteLength,sub.byteLength);
});
test("invalid chunk input fails without creating unbounded capture payloads",async()=>{
  for(const [image,options] of [[[],{}],[new Float32Array(),{}],[new Float32Array(3),{}],[new Float32Array(4),{chunkBytes:0}],[new Float32Array(4),{chunkBytes:17}],[new Float32Array(4),{chunkBytes:64*1024**2}]]){
    await assert.rejects(async()=>{for await(const _ of encodeLinearImageChunks(image,options))void _;},RangeError);
  }
});
