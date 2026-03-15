import { describe, test } from "node:test";

describe("distance-banded lighting contract", () => {
  test.todo(
    "will declare near, mid, far, and horizon lighting bands with explicit primary shadow sources"
  );
  test.todo(
    "will scale ray-traced shadows, reflections, and GI independently by band and importance"
  );
  test.todo(
    "will make temporal reuse and update cadence part of the lighting-band contract"
  );
});

describe("distance-banded lighting unit planning", () => {
  test.todo(
    "will keep near-field lighting on the premium RT path for important lights and surfaces"
  );
  test.todo(
    "will allow mid-field lighting to rely on selective raster shadowing and proxy casters"
  );
  test.todo(
    "will treat horizon lighting as a baked or far-field impression instead of a live object-level shadow system"
  );
});
