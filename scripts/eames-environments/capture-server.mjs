import net from "node:net";
import { spawn } from "node:child_process";
import { resolveCaptureWorkspaceRoot } from "./capture-runtime.mjs";

export const defaultCaptureServerHost = "127.0.0.1";
export const defaultCaptureServerAssetPath = "/gpu-lighting/demo/eames-environments/index.html";

function delayMilliseconds(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export function buildCaptureAssetUrl(baseUrl, assetPath = defaultCaptureServerAssetPath) {
  return new URL(assetPath, `${baseUrl}/`).href;
}

export async function portIsFree(port, host = defaultCaptureServerHost) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function canReuseStaticServer(
  port,
  assetPath = defaultCaptureServerAssetPath,
  fetchImpl = globalThis.fetch
) {
  if (typeof fetchImpl !== "function") {
    return false;
  }
  try {
    const response = await fetchImpl(
      buildCaptureAssetUrl(`http://${defaultCaptureServerHost}:${port}`, assetPath)
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function findCaptureServerPort({
  startPort = 8765,
  attempts = 100,
  assetPath = defaultCaptureServerAssetPath,
  canReuse = canReuseStaticServer,
  isPortFree = portIsFree,
} = {}) {
  for (let port = startPort; port < startPort + attempts; port += 1) {
    if (await canReuse(port, assetPath)) {
      return { port, reuse: true };
    }
    if (await isPortFree(port)) {
      return { port, reuse: false };
    }
  }
  throw new Error("Unable to find or start a local HTTP port for screenshot capture.");
}

export async function waitForCaptureServer(
  url,
  server,
  {
    timeoutMs = 20_000,
    fetchImpl = globalThis.fetch,
    sleep = delayMilliseconds,
  } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to wait for the capture server.");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Static server exited early with code ${server.exitCode}.`);
    }
    try {
      const response = await fetchImpl(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server is listening.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for static server at ${url}.`);
}

export function startCaptureStaticServer(
  port,
  {
    rootDir = resolveCaptureWorkspaceRoot(),
    host = defaultCaptureServerHost,
    stdio = ["ignore", "pipe", "pipe"],
    spawnImpl = spawn,
  } = {}
) {
  const server = spawnImpl(
    "python3",
    ["-m", "http.server", String(port), "--bind", host, "--directory", rootDir],
    { stdio }
  );
  server.stdout?.on?.("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr?.on?.("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  return server;
}

export async function stopCaptureStaticServer(server, gracePeriodMs = 2500) {
  if (!server || server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, gracePeriodMs);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

export async function openCaptureServerSession(options = {}) {
  const selection = await findCaptureServerPort(options);
  const baseUrl = `http://${defaultCaptureServerHost}:${selection.port}`;
  const server = selection.reuse ? null : startCaptureStaticServer(selection.port, options);
  await waitForCaptureServer(
    buildCaptureAssetUrl(baseUrl, options.assetPath),
    server ?? { exitCode: null },
    options
  );
  return {
    baseUrl,
    port: selection.port,
    reuse: selection.reuse,
    server,
    async close() {
      await stopCaptureStaticServer(server);
    },
  };
}
