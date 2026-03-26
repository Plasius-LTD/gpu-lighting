import { mountGpuShowcase as mountHarborShowcase } from "@plasius/gpu-shared";

import { createLightingDemoMountOptions } from "./lighting-demo-config.js";

const root = globalThis.document?.getElementById("app");
if (!root) {
  throw new Error("Lighting demo root element was not found.");
}

await mountHarborShowcase(createLightingDemoMountOptions(root));
