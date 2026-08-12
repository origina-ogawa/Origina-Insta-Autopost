#!/usr/bin/env node
// AI社員の作業イベントを logs/events.jsonl に追記する。
// このログが 3D オフィス表示層への唯一のインターフェースになる。
// スキーマを変えると表示層が壊れるため、変更時は表示層と同時に更新すること。

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ACTORS = ["pm", "researcher", "director", "producer", "inspector", "publisher"];
const EVENTS = ["start", "progress", "output", "handoff", "blocked", "reject", "done"];
const PHASES = ["research", "structure", "produce", "inspect", "publish"];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1] ?? "";
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!ACTORS.includes(args.actor)) {
  console.error(`--actor は次のいずれか: ${ACTORS.join(", ")}`);
  process.exit(1);
}
if (!EVENTS.includes(args.event)) {
  console.error(`--event は次のいずれか: ${EVENTS.join(", ")}`);
  process.exit(1);
}
if (args.phase && !PHASES.includes(args.phase)) {
  console.error(`--phase は次のいずれか: ${PHASES.join(", ")}`);
  process.exit(1);
}

const record = {
  ts: new Date().toISOString(),
  actor: args.actor,
  event: args.event,
  phase: args.phase ?? null,
  ticket: args.ticket ?? null,
  target: args.target ?? null,
  message: args.message ?? "",
};

const logPath = resolve(process.cwd(), "logs/events.jsonl");
mkdirSync(dirname(logPath), { recursive: true });
appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");

console.log(`[${record.actor}] ${record.event} ${record.phase ?? ""} ${record.message}`);
