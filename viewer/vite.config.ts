import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// このステップでは見た目だけを作る。logs/events.jsonl の読み込みは次のステップで追加する。
export default defineConfig({
  plugins: [react()],
});
