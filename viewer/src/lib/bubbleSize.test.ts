import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBubbleSize } from "./bubbleSize.ts";

test("短いメッセージはコンパクトな最小サイズになる", () => {
  const { width, height, maxTextWidth } = computeBubbleSize("テスト");
  assert.equal(width, 1.0);
  assert.ok(Math.abs(height - 0.42) < 0.001);
  assert.ok(Math.abs(maxTextWidth - 0.7) < 0.001);
});

test("長いメッセージ(全角中心)は最大幅でクランプされ、複数行分の高さになる", () => {
  const longText =
    "金曜『SNS集客術』は14日基準を満たすソースが見つからずブロック。鮮度の高い木曜カテゴリへ差し替え";
  const { width, height } = computeBubbleSize(longText);
  assert.equal(width, 2.6);
  assert.ok(Math.abs(height - 1.02) < 0.001);
});

test("全角と半角で幅の重みが異なる(全角の方が幅を要する)", () => {
  const fullwidth = computeBubbleSize("あいうえお");
  const halfwidth = computeBubbleSize("abcde");
  assert.ok(fullwidth.width > halfwidth.width);
});

test("幅は常に最小1.0〜最大2.6の範囲に収まる", () => {
  for (const text of ["", "a", "あ".repeat(3), "あ".repeat(100)]) {
    const { width } = computeBubbleSize(text);
    assert.ok(width >= 1.0 && width <= 2.6);
  }
});
