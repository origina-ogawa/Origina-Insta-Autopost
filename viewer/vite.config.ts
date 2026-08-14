import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// logs/events.jsonl はリポジトリルート(viewer/の外)にある。
// ビルド成果物には含めず、開発サーバーのAPIとしてだけ生データを返す。
function eventsApiPlugin(): Plugin {
  const eventsPath = resolve(import.meta.dirname, "../logs/events.jsonl");

  return {
    name: "events-api",
    configureServer(server) {
      server.middlewares.use("/api/events", (_req, res) => {
        let body = "";
        try {
          body = readFileSync(eventsPath, "utf8");
        } catch {
          // ログがまだ無い場合も表示層は落とさない
          body = "";
        }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(body);
      });
    },
  };
}

// logs/instructions.jsonl はリポジトリルート(viewer/の外)にあり、git管理対象外
// (.gitignore参照)。社長モニターからの指示・一時停止をここに追記し、Claude Code
// セッション側の tail -f で拾えるようにする。
function instructionsApiPlugin(): Plugin {
  const instructionsPath = resolve(import.meta.dirname, "../logs/instructions.jsonl");

  return {
    name: "instructions-api",
    configureServer(server) {
      server.middlewares.use("/api/instructions", (req, res) => {
        if (req.method === "POST") {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(raw) as { kind?: unknown; message?: unknown };
              if (
                (parsed.kind !== "instruction" && parsed.kind !== "stop") ||
                typeof parsed.message !== "string" ||
                parsed.message.length === 0
              ) {
                res.statusCode = 400;
                res.end();
                return;
              }
              const line =
                JSON.stringify({ ts: new Date().toISOString(), kind: parsed.kind, message: parsed.message }) + "\n";
              appendFileSync(instructionsPath, line, "utf8");
              res.statusCode = 200;
              res.end();
            } catch {
              res.statusCode = 400;
              res.end();
            }
          });
          return;
        }

        let body = "";
        try {
          body = readFileSync(instructionsPath, "utf8");
        } catch {
          body = "";
        }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), eventsApiPlugin(), instructionsApiPlugin()],
});
