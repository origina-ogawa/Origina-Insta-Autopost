import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstructions } from "./instructionLog.ts";

test("正常な行をパースする", () => {
  const text =
    '{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"3枚目を短く"}\n' +
    '{"ts":"2026-08-14T05:02:00.000Z","kind":"stop","message":"作業を一時停止してください"}\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, "instruction");
  assert.equal(result[0].message, "3枚目を短く");
  assert.equal(result[1].kind, "stop");
});

test("不正なJSON行はスキップする", () => {
  const text = '{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"ok"}\nnot json\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 1);
});

test("kindが未知の行はスキップする", () => {
  const text = '{"ts":"2026-08-14T05:00:00.000Z","kind":"unknown","message":"x"}\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 0);
});

test("空文字列は空配列を返す", () => {
  assert.deepEqual(parseInstructions(""), []);
});
