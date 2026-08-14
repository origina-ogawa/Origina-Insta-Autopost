import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTORS, WALK_DIR } from "./theme.ts";

test("WALK_DIRは全アクター分そろっており、単位ベクトルになっている", () => {
  for (const actor of ACTORS) {
    const dir = WALK_DIR[actor];
    assert.ok(dir, `${actor} のWALK_DIRが無い`);
    const magnitude = Math.hypot(dir.x, dir.z);
    assert.ok(Math.abs(magnitude - 1) < 1e-9, `${actor} のWALK_DIRが単位ベクトルでない: ${magnitude}`);
  }
});

test("researcher(左列)は左へ退出する", () => {
  const dir = WALK_DIR.researcher;
  assert.ok(Math.abs(dir.x - 1) < 0.001);
  assert.ok(Math.abs(dir.z - 0) < 0.001);
});

test("pm(右列)は右へ退出する", () => {
  const dir = WALK_DIR.pm;
  assert.ok(Math.abs(dir.x - -1) < 0.001);
  assert.ok(Math.abs(dir.z - 0) < 0.001);
});
