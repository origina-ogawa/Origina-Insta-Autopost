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

test("researcher(左寄りの机)の退出方向を検証する", () => {
  const dir = WALK_DIR.researcher;
  assert.ok(Math.abs(dir.x - 0.587785) < 0.001);
  assert.ok(Math.abs(dir.z - -0.809017) < 0.001);
});

test("inspector(右寄りの机)の退出方向を検証する", () => {
  const dir = WALK_DIR.inspector;
  assert.ok(Math.abs(dir.x - -0.891007) < 0.001);
  assert.ok(Math.abs(dir.z - -0.453990) < 0.001);
});
