import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  ensureCaptureArtifactDirectory,
  formatCaptureDiagnostic,
  openCaptureBrowser,
  readCanvasCapture,
  readPageDiagnostic,
  resolveCaptureWorkspaceRoot,
  summarizeRgbaPixels,
  waitForCaptureReady,
  writePngDataUrl,
} from "./capture-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const workspaceRoot = resolveCaptureWorkspaceRoot();
const artifactDirectoryPromise = ensureCaptureArtifactDirectory();
const preset = process.env.PLASIUS_PATH_DEBUG_PRESET ?? "grass-field-midday";
const width = readInteger("PLASIUS_PATH_DEBUG_WIDTH", 1280, 320, 4096);
const height = readInteger("PLASIUS_PATH_DEBUG_HEIGHT", 720, 180, 2304);
const layers = readInteger("PLASIUS_PATH_DEBUG_LAYERS", 8, 1, 16);
const maxDepth = readInteger("PLASIUS_PATH_DEBUG_MAX_DEPTH", 8, 1, 12);
const samplesPerPixel = readInteger("PLASIUS_PATH_DEBUG_SPP", 1, 1, 256);
const frameIndex = readInteger("PLASIUS_PATH_DEBUG_FRAME_INDEX", 777, 0, 1_000_000);
const showSources = process.env.PLASIUS_PATH_DEBUG_SHOW_SOURCES === "1";
const label = sanitize(process.env.PLASIUS_PATH_DEBUG_LABEL ?? "reverse-pass");

function readInteger(name, fallback, minimum, maximum) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function sanitize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") || "debug";
}

async function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function canReuseStaticServer(port) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/gpu-lighting/demo/eames-environments/index.html`
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function findServerPort(start = 8765) {
  for (let port = start; port < start + 100; port += 1) {
    if (await canReuseStaticServer(port)) {
      return { port, reuse: true };
    }
    if (await portIsFree(port)) {
      return { port, reuse: false };
    }
  }
  throw new Error("Unable to find or start a local HTTP port for path-debug capture.");
}

function startStaticServer(port) {
  const server = spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", workspaceRoot],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  return server;
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Static server exited early with code ${server.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the static server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for static server at ${url}.`);
}

async function stopStaticServer(server) {
  if (!server || server.exitCode !== null) {
    return;
  }
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2500);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

function centerProbe(result) {
  const rgba = result?.renderer?.outputProbe?.rgba ?? [0, 0, 0, 0];
  return {
    rgba,
    maxChannel: Math.max(...rgba.slice(0, 3)),
    luminance: result?.renderer?.outputProbe?.luminance ?? 0,
  };
}

async function captureLayer(page, baseUrl, layer) {
  const artifactDirectory = await artifactDirectoryPromise;
  const url = new URL("/gpu-lighting/demo/eames-environments/index.html", baseUrl);
  url.searchParams.set("preset", preset);
  url.searchParams.set("geometry", "mesh");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("frames", "1");
  url.searchParams.set("maxDepth", String(maxDepth));
  url.searchParams.set("samplesPerPixel", String(samplesPerPixel));
  url.searchParams.set("denoise", "0");
  url.searchParams.set("motion", "0");
  url.searchParams.set("probe", "1");
  url.searchParams.set("deferredPathResolve", "1");
  url.searchParams.set("pathDebugLayer", String(layer));
  url.searchParams.set("frameIndex", String(frameIndex));
  url.searchParams.set("showSources", showSources ? "1" : "0");

  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForCaptureReady(page, `layer ${layer}`, 180_000);
  const result = await page.evaluate(() => window.__plasiusCaptureResult ?? window.__plasiusCaptureError);
  if (!result || result.status !== "ok") {
    throw new Error(formatCaptureDiagnostic(`layer ${layer}`, await readPageDiagnostic(page)));
  }
  if (result.maxDepth !== maxDepth) {
    throw new Error(`layer ${layer} rendered maxDepth=${result.maxDepth}; expected ${maxDepth}.`);
  }
  if (result.samplesPerPixel !== samplesPerPixel) {
    throw new Error(`layer ${layer} rendered samplesPerPixel=${result.samplesPerPixel}; expected ${samplesPerPixel}.`);
  }
  if (result.pathDebugLayer !== layer) {
    throw new Error(`layer ${layer} rendered pathDebugLayer=${result.pathDebugLayer}; expected ${layer}.`);
  }

  const canvasCapture = await readCanvasCapture(page);
  if (!canvasCapture?.dataUrl) {
    throw new Error(`layer ${layer} did not expose a readable render canvas.`);
  }
  const canvasStats = summarizeRgbaPixels(canvasCapture.rgbaBytes);
  const screenshot = path.join(
    artifactDirectory,
    `path-debug-${preset}-layer-${String(layer).padStart(2, "0")}-${label}.png`
  );
  const screenshotBytes = await writePngDataUrl(screenshot, canvasCapture.dataUrl);
  const resultPath = path.join(
    artifactDirectory,
    `path-debug-${preset}-layer-${String(layer).padStart(2, "0")}-${label}.json`
  );
  await fs.writeFile(resultPath, `${JSON.stringify({ ...result, canvasStats }, null, 2)}\n`, "utf8");
  return {
    layer,
    reversePass: layer,
    meaning: layer === 0 ? "terminal source only" : `terminal source after ${layer} reverse response pass(es)`,
    screenshot,
    screenshotRelative: path.relative(repoRoot, screenshot),
    screenshotBytes,
    canvasStats,
    resultFile: resultPath,
    resultRelative: path.relative(repoRoot, resultPath),
    centerProbe: centerProbe(result),
    probeSummary: result.probeSummary,
    renderer: result.renderer,
  };
}

async function main() {
  const artifactDirectory = await artifactDirectoryPromise;
  const { port, reuse } = await findServerPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = reuse ? null : startStaticServer(port);
  await waitForServer(
    `${baseUrl}/gpu-lighting/demo/eames-environments/index.html`,
    server ?? { exitCode: null }
  );

  let browserSession;
  try {
    browserSession = await openCaptureBrowser();
    const page = await browserSession.context.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        const source = location.url ? ` (${location.url}:${location.lineNumber})` : "";
        console.error(`[browser] ${message.text()}${source}`);
      }
    });
    page.on("response", (response) => {
      if (response.ok()) {
        return;
      }
      const responseUrl = new URL(response.url());
      if (responseUrl.pathname !== "/favicon.ico") {
        console.error(`[browser] ${response.status()} ${response.statusText()} ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      console.error(`[browser] request failed ${request.url()}: ${request.failure()?.errorText ?? "unknown error"}`);
    });

    const results = [];
    for (let layer = 0; layer < layers; layer += 1) {
      console.log(`capturing reverse-pass layer ${layer}`);
      results.push(await captureLayer(page, baseUrl, layer));
    }

    const manifest = {
      preset,
      width,
      height,
      layers,
      maxDepth,
      samplesPerPixel,
      frameIndex,
      showSources,
      baseUrl,
      results,
    };
    const manifestPath = path.join(artifactDirectory, `path-debug-${preset}-${label}.json`);
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const summaryPath = path.join(artifactDirectory, `path-debug-${preset}-${label}.md`);
    await fs.writeFile(summaryPath, renderSummary(manifest), "utf8");
    console.log(`wrote ${manifestPath}`);
    console.log(`wrote ${summaryPath}`);
  } finally {
    await browserSession?.close();
    await stopStaticServer(server);
  }
}

function renderSummary(manifest) {
  const lines = [
    `# Path Debug: ${manifest.preset}`,
    ``,
    `Resolution: ${manifest.width}x${manifest.height}`,
    `Max depth: ${manifest.maxDepth}`,
    `SPP: ${manifest.samplesPerPixel}`,
    `Frame seed index: ${manifest.frameIndex}`,
    ``,
    `| Layer | Meaning | Center RGBA | Center max | Black | Near <=16 | Avg canvas luminance | Probe non-zero | Avg probe luminance | Screenshot |`,
    `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
  ];
  for (const result of manifest.results) {
    const center = result.centerProbe;
    const probe = result.probeSummary;
    lines.push(
      `| ${result.layer} | ${result.meaning} | ${center.rgba.join(", ")} | ${center.maxChannel} | ` +
        `${result.canvasStats.exactBlackPixels} | ${result.canvasStats.nearBlackPixels16} | ` +
        `${result.canvasStats.averageLuminance.toFixed(4)} | ` +
        `${probe.nonZeroSamples}/${probe.sampledPixels} | ${probe.averageLuminance.toFixed(4)} | ` +
        `${result.screenshotRelative} |`
    );
  }
  lines.push(``);
  return `${lines.join("\n")}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
