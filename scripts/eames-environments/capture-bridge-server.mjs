import fs from "node:fs/promises";
import fsSync from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  decodePngDataUrl,
  resolveCapturePackageRoot,
  resolveCaptureWorkspaceRoot,
} from "./capture-runtime.mjs";

const workspaceRoot = resolveCaptureWorkspaceRoot();
const packageRoot = resolveCapturePackageRoot();
const captureOutputRoot = path.resolve(workspaceRoot, "output/playwright/eames-environments");
const port = Number(process.argv[2] ?? 8001);
const trustedLoopbackHostnames = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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

function applyCaptureCorsHeaders(response, origin) {
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET, HEAD, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-max-age", "86400");
  response.setHeader("vary", "Origin");
}

function resolveWorkspacePath(requestPath) {
  const relativePath = String(requestPath ?? "").replace(/^\/+/, "");
  const pathSegments = relativePath.split("/");
  const servesActivePackage = pathSegments[0] === "gpu-lighting";
  const installedPackageRoot = /^gpu-[a-z0-9-]+$/u.test(pathSegments[0])
    ? path.resolve(packageRoot, "node_modules", "@plasius", pathSegments[0])
    : null;
  const servesInstalledPackage =
    !servesActivePackage &&
    installedPackageRoot !== null &&
    fsSync.existsSync(installedPackageRoot);
  const selectedRoot = servesActivePackage
    ? packageRoot
    : servesInstalledPackage
      ? installedPackageRoot
      : workspaceRoot;
  const selectedRelativePath = servesActivePackage || servesInstalledPackage
    ? pathSegments.slice(1).join("/")
    : relativePath;
  const resolvedPath = path.resolve(selectedRoot, selectedRelativePath);
  const relativeToRoot = path.relative(selectedRoot, resolvedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Path escapes its capture root.");
  }
  return resolvedPath;
}

function resolveCaptureOutputPath(requestPath) {
  const resolvedPath = resolveWorkspacePath(requestPath);
  const relativeToOutputRoot = path.relative(captureOutputRoot, resolvedPath);
  if (relativeToOutputRoot.startsWith("..") || path.isAbsolute(relativeToOutputRoot)) {
    throw new Error("Capture upload path must stay within output/playwright/eames-environments.");
  }
  return resolvedPath;
}

function resolveTrustedCaptureOrigin(request) {
  const originHeader =
    typeof request.headers.origin === "string" && request.headers.origin.length > 0
      ? request.headers.origin
      : null;
  if (!originHeader) {
    return null;
  }
  let origin;
  try {
    origin = new URL(originHeader);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(origin.protocol)) {
    return null;
  }
  if (!trustedLoopbackHostnames.has(origin.hostname.toLowerCase())) {
    return null;
  }
  return origin.origin;
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
  const outputPath = resolveCaptureOutputPath(payload.path);
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

export async function readStaticAssetResponse(requestPath) {
  const requestedPath = resolveWorkspacePath(requestPath);
  let filePath = requestedPath;
  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch (error) {
    if (error?.code === "EISDIR") {
      filePath = path.join(requestedPath, "index.html");
      fileBuffer = await fs.readFile(filePath);
    } else {
      throw error;
    }
  }
  const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
  return { contentType, fileBuffer };
}

async function serveStaticAsset(requestPath, response) {
  let asset;
  try {
    asset = await readStaticAssetResponse(requestPath);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("File not found");
    return;
  }

  const { contentType, fileBuffer } = asset;
  response.writeHead(200, { "content-type": contentType });
  response.end(fileBuffer);
}

export function createCaptureBridgeServer(host = "127.0.0.1") {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
      if (request.method === "OPTIONS" && url.pathname === "/__plasius-capture") {
        const trustedOrigin = resolveTrustedCaptureOrigin(request);
        if (!trustedOrigin) {
          response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
          response.end("Capture bridge only accepts loopback browser origins.");
          return;
        }
        applyCaptureCorsHeaders(response, trustedOrigin);
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === "POST" && url.pathname === "/__plasius-capture") {
        const trustedOrigin = resolveTrustedCaptureOrigin(request);
        if (!trustedOrigin) {
          response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
          response.end("Capture bridge only accepts loopback browser origins.");
          return;
        }
        applyCaptureCorsHeaders(response, trustedOrigin);
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
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (
  !globalThis.__PLASIUS_CAPTURE_BRIDGE_MODULE_ONLY__ &&
  invokedPath === import.meta.url
) {
  const server = createCaptureBridgeServer();
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`capture bridge listening on http://127.0.0.1:${port}\n`);
  });
}
