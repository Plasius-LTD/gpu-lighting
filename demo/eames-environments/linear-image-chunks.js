// Lossless bounded payloads; byte planes improve float compression without quantization.
export async function* encodeLinearImageChunks(image,{chunkBytes=4*1024**2}={}) {
  if(!(image instanceof Float32Array)||!image.length||image.length%4||!Number.isSafeInteger(chunkBytes)||chunkBytes<16||chunkBytes%16||chunkBytes>8*1024**2)
    throw new RangeError("Require RGBA float32 and pixel-aligned chunks no larger than 8 MiB.");
  const source=new Uint8Array(image.buffer,image.byteOffset,image.byteLength);
  for(let offset=0;offset<source.length;offset+=chunkBytes){
    const raw=source.subarray(offset,Math.min(source.length,offset+chunkBytes)),shuffled=new Uint8Array(raw.length),n=raw.length/4;
    for(let plane=0;plane<4;plane++)for(let i=0;i<n;i++)shuffled[plane*n+i]=raw[i*4+plane];
    const bytes=new Uint8Array(await new Response(new Blob([shuffled]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    let text="";for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)),b=>b.toString(16).padStart(2,"0")).join("");
    yield {format:"float32-byteplanes-gzip-base64",byteOffset:offset,byteLength:raw.length,totalBytes:source.length,sha256,data:btoa(text)};
  }
}
