import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

test("lighting demo config wires the shared 3D showcase callbacks and metadata", () => {
  const source = readFileSync(path.join(repoRoot, "demo", "lighting-demo-config.js"), "utf8");

  assert.match(source, /packageName: "@plasius\/gpu-lighting"/);
  assert.match(source, /title: "Lighting Bands in a 3D Harbor"/);
  assert.match(source, /createState: createLightingDemoState/);
  assert.match(source, /updateState: updateLightingDemoState/);
  assert.match(source, /describeState: describeLightingDemoState/);
});

test("lighting demo config keeps live 3D lighting and catalog metrics visible", () => {
  const source = readFileSync(path.join(repoRoot, "demo", "lighting-demo-config.js"), "utf8");

  assert.match(source, /Lighting live · \$\{bandPlan\.profile\} profile/);
  assert.match(source, /`ships: \$\{scene\.ships\.length\} GLTF hulls`/);
  assert.match(source, /`profile: \$\{bandPlan\.profile\}`/);
  assert.match(source, /`importance: \$\{bandPlan\.importance\}`/);
  assert.match(source, /`near shadows: \$\{nearBand\.primaryShadowSource\}`/);
  assert.match(source, /`near cadence divisor: \$\{nearBand\.updateCadenceDivisor\}x`/);
  assert.match(source, /@plasius\/gpu-shared harbor runtime/);
});

test("lighting demo browser entry uses the public gpu-shared package surface", () => {
  const html = readFileSync(path.join(repoRoot, "demo", "index.html"), "utf8");
  const source = readFileSync(path.join(repoRoot, "demo", "main.js"), "utf8");
  const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

  assert.match(
    html,
    /"@plasius\/gpu-shared": "\.\.\/node_modules\/@plasius\/gpu-shared\/dist\/index\.js"/
  );
  assert.match(source, /from "@plasius\/gpu-shared"/);
  assert.doesNotMatch(source, /node_modules\/@plasius\/gpu-shared\/dist/);
  assert.doesNotMatch(readme, /does not mount a 3D canvas/i);
  assert.match(readme, /mounts the shared 3D harbor validation scene/i);
});
