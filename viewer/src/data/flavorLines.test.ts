import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTORS } from "../theme.ts";
import { FLAVOR_LINES } from "./flavorLines.ts";

test("全アクターに6件以上のセリフが用意されている", () => {
  for (const actor of ACTORS) {
    assert.ok(Array.isArray(FLAVOR_LINES[actor]), `${actor} の配列が無い`);
    assert.ok(FLAVOR_LINES[actor].length >= 6, `${actor} のセリフが6件未満`);
  }
});

test("各アクター内でセリフが重複していない", () => {
  for (const actor of ACTORS) {
    const lines = FLAVOR_LINES[actor];
    assert.equal(new Set(lines).size, lines.length, `${actor} に重複したセリフがある`);
  }
});

test("すべてのセリフが空文字でない", () => {
  for (const actor of ACTORS) {
    for (const line of FLAVOR_LINES[actor]) {
      assert.ok(line.trim().length > 0);
    }
  }
});
