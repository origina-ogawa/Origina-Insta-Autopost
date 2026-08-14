import { useCallback, useEffect, useState } from "react";

export type InstructionEntry = {
  ts: string;
  kind: "instruction" | "stop";
  message: string;
};

// logs/instructions.jsonl の生テキスト(JSON Lines)から、パース可能な行だけを取り出す。
// events.jsonl(eventLog.ts)と同じ方針で、不正な行(パース失敗・未知のkind)はスキップし
// 表示層は落とさない。
export function parseInstructions(fullText: string): InstructionEntry[] {
  return fullText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line): InstructionEntry | null => {
      try {
        const parsed = JSON.parse(line);
        if (
          typeof parsed.ts === "string" &&
          (parsed.kind === "instruction" || parsed.kind === "stop") &&
          typeof parsed.message === "string"
        ) {
          return parsed as InstructionEntry;
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is InstructionEntry => entry !== null);
}

const POLL_INTERVAL_MS = 2000;

// logs/instructions.jsonl の全件をポーリング取得するフック(eventLog.tsの差分方式とは異なり、
// 履歴表示のため常に全文を読み直す。ファイルは小さく運用中のみのデータのため問題ない)。
// sendInstructionはPOSTで新しい指示を送る(送信後の反映は次回ポーリングを待つ)。
export function useInstructionLog(): {
  history: InstructionEntry[];
  send: (kind: "instruction" | "stop", message: string) => Promise<void>;
} {
  const [history, setHistory] = useState<InstructionEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/instructions", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (!cancelled) setHistory(parseInstructions(text));
      } catch {
        // devサーバー再起動中など。次のポーリングで復帰する
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const send = useCallback(async (kind: "instruction" | "stop", message: string) => {
    await fetch("/api/instructions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, message }),
    });
  }, []);

  return { history, send };
}
