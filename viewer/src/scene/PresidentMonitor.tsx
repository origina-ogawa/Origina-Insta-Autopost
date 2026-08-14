import { useState } from "react";
import { Billboard, Html } from "@react-three/drei";
import type { InstructionEntry } from "../lib/instructionLog";

const STOP_MESSAGE = "作業を一時停止してください";
const HISTORY_LIMIT = 5;

// 社長席の奥の壁に掛けた、モニター風の3Dオブジェクト。画面部分にHTMLパネルを重ね、
// 指示入力欄・送信履歴・一時停止ボタンを表示する。Htmlは通常モード(スクリーン空間の
// オーバーレイ)で使い、3Dワールド座標へ縮小されないようにする(transformモードだと
// 固定カメラの表示倍率では文字がほぼ判読不能になるため)。モニターのベゼル(枠)部分は
// Billboardで常にカメラへ正対させる(NameSign/SpeechBubbleと同じパターン)。壁掛けのため
// 机に接続するスタンドは持たない。
export function PresidentMonitor({
  history,
  send,
}: {
  history: InstructionEntry[];
  send: (kind: "instruction" | "stop", message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      await send("instruction", message);
      setDraft("");
    } catch {
      setError("送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  async function handleStop() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await send("stop", STOP_MESSAGE);
    } catch {
      setError("送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  const recent = history.slice(-HISTORY_LIMIT);

  return (
    <group position={[0, 2, 2.1]}>
      <Billboard>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.85, 0.04]} />
          <meshStandardMaterial color="#3A3530" roughness={0.7} metalness={0} />
        </mesh>
        <Html position={[0, 0, 0.03]} style={{ pointerEvents: "auto" }}>
          <div className="president-monitor">
            <div className="president-monitor__history">
              {recent.length === 0 ? (
                <p className="president-monitor__empty">まだ指示はありません</p>
              ) : (
                recent.map((entry, i) => (
                  <p
                    key={`${entry.ts}-${i}`}
                    className={entry.kind === "stop" ? "president-monitor__entry--stop" : "president-monitor__entry"}
                  >
                    {entry.message}
                  </p>
                ))
              )}
            </div>
            {error && <p className="president-monitor__entry--stop">{error}</p>}
            <textarea
              className="president-monitor__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="指示を入力..."
            />
            <div className="president-monitor__buttons">
              <button
                type="button"
                className="president-monitor__send"
                onClick={handleSend}
                disabled={sending || draft.trim().length === 0}
              >
                送信
              </button>
              <button type="button" className="president-monitor__stop" onClick={handleStop} disabled={sending}>
                一時停止
              </button>
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
