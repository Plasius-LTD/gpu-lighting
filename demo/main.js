import { mountGpuShowcase } from "../../gpu-demo-viewer/shared/showcase-runtime.js";

const root = globalThis.document?.getElementById("app");
if (!root) {
  throw new Error("Lighting demo root element was not found.");
}

await mountGpuShowcase({
  root,
  focus: "lighting",
  packageName: "@plasius/gpu-lighting",
  title: "Lighting Bands in a 3D Harbor",
  subtitle:
    "Renderer-facing 3D lighting preview with GLTF ships, distance-banded shadows, and live lighting policy overlays instead of a static technique list.",
});
