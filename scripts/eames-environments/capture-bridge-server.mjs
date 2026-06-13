import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngDataUrl } from "./capture-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../..");
const port = Number(process.argv[2] ?? 8001);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".gltf", "model/gltf+json"],
  [".bin", "application/octet-stream"],
]);

function applyCorsHeaders(request, response) {
  const origin =
    typeof request.headers.origin === "string" && request.headers.origin.length > 0
      ? request.headers.origin
      : "*";
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET, HEAD, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-max-age", "86400");
  if (origin !== "*") {
    response.setHeader("vary", "Origin");
  }
}

function resolveWorkspacePath(requestPath) {
  const relativePath = String(requestPath ?? "").replace(/^\/+/, "");
  const resolvedPath = path.resolve(workspaceRoot, relativePath);
  const relativeToWorkspace = path.relative(workspaceRoot, resolvedPath);
  if (relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace)) {
    throw new Error("Path escapes workspace root.");
  }
  return resolvedPath;
}

async function readRequestBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > 64 * 1024 * 1024) {
      throw new Error("Capture upload exceeds the 64 MB limit.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeCaptureArtifact(request, response) {
  const body = await readRequestBody(request);
  const payload = JSON.parse(body);
  const outputPath = resolveWorkspacePath(payload.path);
  const buffer = decodePngDataUrl(payload.dataUrl);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  if (payload.result && typeof payload.result === "object") {
    const metadataPath = outputPath.replace(/\.png$/i, ".json");
    await fs.writeFile(metadataPath, `${JSON.stringify(payload.result, null, 2)}\n`, "utf8");
  }
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(
    JSON.stringify({
      ok: true,
      path: path.relative(workspaceRoot, outputPath),
      bytes: buffer.length,
    })
  );
}

async function serveStaticAsset(requestPath, response) {
  let filePath = resolveWorkspacePath(requestPath);
  let stats = null;
  try {
    stats = await fs.stat(filePath);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("File not found");
    return;
  }

  if (stats.isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("File not found");
    return;
  }

  const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
  response.writeHead(200, { "content-type": contentType });
  response.end(fileBuffer);
}

const server = http.createServer(async (request, response) => {
  try {
    applyCorsHeaders(request, response);
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
    if (request.method === "OPTIONS" && url.pathname === "/__plasius-capture") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "POST" && url.pathname === "/__plasius-capture") {
      await writeCaptureArtifact(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }
    await serveStaticAsset(url.pathname, response);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Unknown server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`capture bridge listening on http://127.0.0.1:${port}\n`);
});
