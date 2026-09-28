import test from "node:test";
import assert from "node:assert/strict";
import {createRoughSplittingScene, validateRoughSplittingProbe} from "../demo/eames-environments/rough-splitting-scenes.js";
test("rough splitting probes retain the same full BSDF and frozen energy screens", () => {
  for (const name of ["black", "emissive", "diffuse-constant"]) {
    const scene = createRoughSplittingScene(name);
    assert.equal(scene.probeDepth, 6);assert.equal(scene.meshes[0].roughness, 0.9);
    const pixel = name === "emissive" ? [4, 2, 1, 1] : name === "black" ? [0, 0, 0, 1] : [0.4, 0.2, 0.1, 1];
    assert.equal(validateRoughSplittingProbe(name, pixel, pixel).passed, true);
  }
  assert.throws(() => createRoughSplittingScene("unknown"));
  for (const image of [[], [0], [0, 0, 0, 0], [NaN, 0, 0, 1], [-1, 0, 0, 1]]) assert.throws(() => validateRoughSplittingProbe("black", image, [0, 0, 0, 1]));
  assert.throws(() => validateRoughSplittingProbe("black", [1, 0, 0, 1], [0, 0, 0, 1]));
  assert.throws(() => validateRoughSplittingProbe("emissive", [1, 2, 1, 1], [4, 2, 1, 1]));
  assert.throws(() => validateRoughSplittingProbe("diffuse-constant", [1.03, 1, 1, 1], [1, 1, 1, 1]));
  assert.throws(() => validateRoughSplittingProbe("diffuse-constant", [0, 0, 0, 1], [0, 0, 0, 1]));
  assert.throws(() => validateRoughSplittingProbe("unknown", [0, 0, 0, 1], [0, 0, 0, 1]));
});
