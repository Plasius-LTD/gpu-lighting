import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(packageRoot, "..");
const repoRoot = path.resolve(__dirname, "../../..");
const defaultCaptureArtifactDirectory = path.join(
  repoRoot,
  "output/playwright/eames-environments"
);

export function readOptionalString(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function resolveCaptureBrowserProfileDirectory(
  tempRoot = os.tmpdir(),
  processId = process.pid
) {
  return path.join(tempRoot, `plasius-playwright-eames-${processId}`);
}

export function resolveCaptureArtifactDirectory(value = process.env.PLASIUS_CAPTURE_OUTPUT_DIR) {
  const selected = readOptionalString(value);
  if (!selected) {
    return defaultCaptureArtifactDirectory;
  }
  return path.isAbsolute(selected) ? selected : path.resolve(repoRoot, selected);
}

export function resolveCaptureWorkspaceRoot() {
  return workspaceRoot;
}

export async function ensureCaptureArtifactDirectory(value) {
  const directory = resolveCaptureArtifactDirectory(value);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export function decodePngDataUrl(value) {
  const text = String(value ?? "").trim().replace(/^"|"$/g, "");
  if (!text.startsWith("data:image/png;base64,")) {
    throw new Error("Expected a PNG data URL.");
  }
  return Buffer.from(text.slice("data:image/png;base64,".length), "base64");
}

export async function writePngDataUrl(outputPath, value) {
  const buffer = decodePngDataUrl(value);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  return buffer.length;
}

export function summarizeRgbaPixels(rgbaBytes) {
  if (!rgbaBytes || rgbaBytes.length % 4 !== 0) {
    throw new Error("RGBA byte buffer must be present and divisible by 4.");
  }
  let exactBlackPixels = 0;
  let nearBlackPixels8 = 0;
  let nearBlackPixels16 = 0;
  let opaquePixels = 0;
  let luminanceTotal = 0;
  for (let index = 0; index < rgbaBytes.length; index += 4) {
    const red = rgbaBytes[index];
    const green = rgbaBytes[index + 1];
    const blue = rgbaBytes[index + 2];
    const alpha = rgbaBytes[index + 3];
    if (alpha <= 0) {
      continue;
    }
    opaquePixels += 1;
    const maxChannel = Math.max(red, green, blue);
    if (red === 0 && green === 0 && blue === 0) {
      exactBlackPixels += 1;
    }
    if (maxChannel <= 8) {
      nearBlackPixels8 += 1;
    }
    if (maxChannel <= 16) {
      nearBlackPixels16 += 1;
    }
    luminanceTotal += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }
  return {
    exactBlackPixels,
    nearBlackPixels8,
    nearBlackPixels16,
    opaquePixels,
    averageLuminance: opaquePixels > 0 ? luminanceTotal / opaquePixels : 0,
  };
}

export function looksLikeBrowserBootstrapFailure(error) {
  const message = String(error?.message ?? error ?? "");
  return (
    message.includes("MachPortRendezvousServer") ||
    message.includes("Crashpad/settings.dat") ||
    message.includes("browserType.launch") ||
    message.includes("browserType.launchPersistentContext")
  );
}

export function formatCaptureDiagnostic(label, diagnostic) {
  if (!diagnostic) {
    return `${label} failed before page diagnostics were available.`;
  }
  const state = diagnostic.state ?? null;
  const error = diagnostic.error ?? null;
  const webgpu = diagnostic.webgpu ?? state?.webgpu ?? null;
  return [
    `${label} failed.`,
    error?.message ? `message: ${error.message}` : null,
    state?.step ? `step: ${state.step}` : null,
    state?.detail ? `detail: ${state.detail}` : null,
    webgpu ? `webgpu.hasGpu: ${webgpu.hasGpu}` : null,
    webgpu ? `webgpu.secureContext: ${webgpu.secureContext}` : null,
    diagnostic.hudText ? `hud: ${diagnostic.hudText}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function readPageDiagnostic(page) {
  try {
    return await page.evaluate(() => ({
      ready: window.__plasiusCaptureReady === true,
      state: window.__plasiusCaptureState ?? null,
      error: window.__plasiusCaptureError ?? null,
      webgpu: window.__plasiusCaptureState?.webgpu ?? null,
      hudText: document.getElementById("hud")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    }));
  } catch {
    return null;
  }
}

export async function waitForCaptureReady(page, label, timeoutMs) {
  try {
    await page.waitForFunction(() => window.__plasiusCaptureReady === true, undefined, {
      timeout: timeoutMs,
    });
  } catch (error) {
    const diagnostic = await readPageDiagnostic(page);
    throw new Error(formatCaptureDiagnostic(label, diagnostic), { cause: error });
  }
}

export async function readCanvasCapture(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const image = await new Promise((resolve, reject) => {
      const preview = new Image();
      preview.addEventListener("load", () => resolve(preview), { once: true });
      preview.addEventListener("error", () => reject(new Error("Unable to decode canvas PNG data URL.")), {
        once: true,
      });
      preview.src = dataUrl;
    });
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = image.naturalWidth || image.width;
    sampleCanvas.height = image.naturalHeight || image.height;
    const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Unable to create 2D context for canvas diagnostics.");
    }
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const bytes = Array.from(imageData.data);
    return {
      dataUrl,
      width: sampleCanvas.width,
      height: sampleCanvas.height,
      rgbaBytes: bytes,
    };
  });
}

export async function openCaptureBrowser() {
  const cdpUrl = readOptionalString(process.env.PLASIUS_CAPTURE_CDP_URL);
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    return {
      context,
      mode: "cdp",
      async close() {
        await browser.close();
      },
    };
  }

  const userDataDir = resolveCaptureBrowserProfileDirectory();
  const launchOptions = {
    args: [
      "--enable-unsafe-webgpu",
      "--disable-dawn-features=disallow_unsafe_apis",
      "--ignore-gpu-blocklist",
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-features=MachPortRendezvousServer",
    ],
  };
  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOptions,
      headless: false,
      channel: "chromium",
    });
    return {
      context,
      mode: "playwright-launch-headed",
      async close() {
        await context.close();
      },
    };
  } catch (headedError) {
    console.error(
      `[browser] headed chromium launch failed: ${
        headedError instanceof Error ? headedError.message : String(headedError)
      }`
    );
    if (looksLikeBrowserBootstrapFailure(headedError)) {
      throw new Error(
        "Playwright Chromium failed before page load. Start a WebGPU-capable Chrome with remote debugging and set PLASIUS_CAPTURE_CDP_URL=http://127.0.0.1:<port>.",
        { cause: headedError }
      );
    }
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOptions,
      headless: true,
    });
    return {
      context,
      mode: "playwright-launch-headless",
      async close() {
        await context.close();
      },
    };
  }
}
