import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
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

export default defineConfig({
  plugins: [react(), eventsApiPlugin()],
});
