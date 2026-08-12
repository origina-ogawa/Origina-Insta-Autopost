#!/usr/bin/env node
// Claude Code の hooks から呼ばれ、標準入力のイベントを logs/events.jsonl に記録する。
// hooks は機械的に発火するため、エージェントの記録漏れをここで補完できる。
// スキーマは logs/SCHEMA.md を参照。

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const hookName = process.argv[2] ?? "unknown";

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    payload = { raw: raw.slice(0, 200) };
  }

  const record = {
    ts: new Date().toISOString(),
    actor: payload.subagent_type ?? payload.agent ?? "system",
    event: hookName === "SubagentStop" ? "done" : "output",
    phase: null,
    ticket: process.env.TICKET ?? null,
    target: payload.tool_input?.file_path ?? null,
    message: `[hook:${hookName}] ${payload.tool_name ?? ""}`.trim(),
  };

  const logPath = resolve(process.cwd(), "logs/events.jsonl");
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");
  process.exit(0);
});
