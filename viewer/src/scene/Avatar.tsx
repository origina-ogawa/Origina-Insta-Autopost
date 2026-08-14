import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { PALETTE, LEAN_TO_NEXT, LEAN_TO_PREV, WALK_DIR, WALK_DISTANCE, type ActorId } from "../theme";
import type { ActorState } from "../state/officeState";
import { SpeechBubble } from "./SpeechBubble";
import { FLAVOR_LINES } from "../data/flavorLines";

const SHOE_COLOR = "#6B5638";
const IDLE_GRAY = "#B9B0A4";
const BLOCKED_DIM = 0.35; // blocked(待機姿勢)のとき、色を少し白側へ寄せて落ち着かせる
const REJECT_RED = "#E14B3A";
const BUBBLE_MS = 4000;
const FLAVOR_MIN_INTERVAL_MS = 6000;
const FLAVOR_MAX_INTERVAL_MS = 9000;
const FLAVOR_DURATION_MS = 3000;
const FLAVOR_BG = "#fff6d9";
const TWEEN_MS = 700; // 動きは控えめに。ease-in-out、0.5〜1秒の範囲
const LEAN_DISTANCE = 0.4; // handoff/rejectで身を乗り出す距離(控えめ)
const WALK_MS = 1200; // 出社/退社の所要時間
const WALK_BOB_HEIGHT = 0.08; // 歩行中の上下バウンス幅

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 0→1→0の山型(出て戻る動き・フラッシュ用)。ease-in-outで滑らかにする
function pulse(t: number) {
  const folded = t < 0.5 ? t * 2 : (1 - t) * 2;
  return easeInOutCubic(folded);
}

type ScaleAnim = { start: number; from: number; to: number };
type LeanAnim = { start: number; dir: { x: number; z: number } };
type WalkAnim = { start: number; from: number; to: number; dir: { x: number; z: number } };

// ローポリのチビキャラをプリミティブだけで組み立てる(外部モデル不使用)。
// logs/SCHEMA.md の7イベントに応じて、控えめな動き(ease-in-out, 0.5〜1秒)で反応する。
export function Avatar({
  actor,
  color,
  state,
  batchCount,
}: {
  actor: ActorId;
  color: string;
  state: ActorState;
  batchCount: number;
}) {
  const bodyColor = useMemo(() => {
    const base = state.active ? color : IDLE_GRAY;
    if (state.event === "blocked") {
      return new THREE.Color(base).lerp(new THREE.Color("#ffffff"), BLOCKED_DIM).getStyle();
    }
    return base;
  }, [state.active, state.event, color]);

  // 胴体・腕・脚・頭・手で素材を共有し、色の変更を1箇所で済ませられるようにする
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 }), []);
  const skinMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.75, metalness: 0 }),
    [],
  );
  useEffect(() => {
    bodyMaterial.color.set(bodyColor);
  }, [bodyMaterial, bodyColor]);

  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh>(null);
  const flashMatRef = useRef<MeshStandardMaterial>(null);
  const presentRef = useRef(false); // 出社しているか(true=机にいる状態)

  const scaleAnim = useRef<ScaleAnim | null>(null);
  const leanAnim = useRef<LeanAnim | null>(null);
  const walkAnim = useRef<WalkAnim | null>(null);
  const rejectFlashAnim = useRef<number | null>(null);

  const [bubble, setBubble] = useState<string | null>(null);
  const [flavor, setFlavor] = useState<string | null>(null);
  const bubbleRef = useRef<string | null>(null);
  const eventRef = useRef(state.event);
  const lastFlavorRef = useRef<string | null>(null);

  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);

  useEffect(() => {
    eventRef.current = state.event;
  }, [state.event]);

  useEffect(() => {
    if (!state.active) {
      setFlavor(null);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let hideTimeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const delay = FLAVOR_MIN_INTERVAL_MS + Math.random() * (FLAVOR_MAX_INTERVAL_MS - FLAVOR_MIN_INTERVAL_MS);
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        const canSpeak = !bubbleRef.current && eventRef.current !== "blocked" && eventRef.current !== "done";
        if (canSpeak) {
          const lines = FLAVOR_LINES[actor];
          const candidates = lines.filter((line) => line !== lastFlavorRef.current);
          const line = candidates[Math.floor(Math.random() * candidates.length)] ?? lines[0];
          lastFlavorRef.current = line;
          setFlavor(line);
          hideTimeoutId = setTimeout(() => {
            if (!cancelled) setFlavor(null);
          }, FLAVOR_DURATION_MS);
        }
        tick();
      }, delay);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(hideTimeoutId);
    };
  }, [state.active, actor]);

  useEffect(() => {
    if (state.seq === 0) return;

    const isInitialCatchUp = batchCount === 1;

    const shouldBePresent = state.event !== "done";
    if (shouldBePresent !== presentRef.current) {
      const dir = WALK_DIR[actor];
      if (isInitialCatchUp || !dir) {
        presentRef.current = shouldBePresent;
        if (groupRef.current) groupRef.current.visible = shouldBePresent;
      } else if (shouldBePresent) {
        presentRef.current = true;
        if (groupRef.current) groupRef.current.visible = true;
        leanAnim.current = null;
        walkAnim.current = { start: performance.now(), from: WALK_DISTANCE[actor], to: 0, dir };
      } else {
        leanAnim.current = null;
        walkAnim.current = { start: performance.now(), from: 0, to: WALK_DISTANCE[actor], dir };
        presentRef.current = false;
      }
    }

    if (state.event === "start") {
      scaleAnim.current = { start: performance.now(), from: 0.85, to: 1 };
    }
    if (state.event === "handoff") {
      const dir = LEAN_TO_NEXT[actor];
      if (dir) leanAnim.current = { start: performance.now(), dir };
    }
    if (state.event === "reject") {
      rejectFlashAnim.current = performance.now();
      const dir = LEAN_TO_PREV[actor];
      if (dir) leanAnim.current = { start: performance.now(), dir };
    }

    if (state.message) {
      setBubble(state.message);
      const id = setTimeout(() => setBubble(null), BUBBLE_MS);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq]);

  useFrame(() => {
    const now = performance.now();

    if (groupRef.current) {
      if (scaleAnim.current) {
        const { start, from, to } = scaleAnim.current;
        const t = Math.min(1, (now - start) / TWEEN_MS);
        groupRef.current.scale.setScalar(from + (to - from) * easeInOutCubic(t));
        if (t >= 1) scaleAnim.current = null;
      }
      if (walkAnim.current) {
        const { start, from, to, dir } = walkAnim.current;
        const t = Math.min(1, (now - start) / WALK_MS);
        const eased = easeInOutCubic(t);
        const amount = from + (to - from) * eased;
        groupRef.current.position.x = dir.x * amount;
        groupRef.current.position.z = dir.z * amount;
        groupRef.current.position.y = 0.32 + Math.sin(t * Math.PI) * WALK_BOB_HEIGHT;
        if (t >= 1) {
          walkAnim.current = null;
          groupRef.current.position.y = 0.32;
          if (!presentRef.current) groupRef.current.visible = false;
        }
      } else if (leanAnim.current) {
        const { start, dir } = leanAnim.current;
        const t = Math.min(1, (now - start) / TWEEN_MS);
        const amount = pulse(t) * LEAN_DISTANCE;
        groupRef.current.position.x = dir.x * amount;
        groupRef.current.position.z = dir.z * amount;
        if (t >= 1) leanAnim.current = null;
      }
    }

    if (flashRef.current && flashMatRef.current) {
      if (rejectFlashAnim.current !== null) {
        const t = Math.min(1, (now - rejectFlashAnim.current) / TWEEN_MS);
        flashMatRef.current.opacity = pulse(t) * 0.6;
        flashRef.current.visible = true;
        if (t >= 1) rejectFlashAnim.current = null;
      } else {
        flashRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.32, 0]} visible={false}>
      {/* 胴体 */}
      <mesh position={[0, 0.55, 0]} material={bodyMaterial} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.4]} />
      </mesh>

      {/* reject時に一瞬だけ赤く光らせるオーバーレイ */}
      <mesh ref={flashRef} position={[0, 0.55, 0]} visible={false}>
        <boxGeometry args={[0.68, 0.68, 0.46]} />
        <meshStandardMaterial ref={flashMatRef} color={REJECT_RED} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 頭 */}
      <mesh position={[0, 1.15, 0]} material={skinMaterial} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
      </mesh>

      {/* 目(白目+黒目のハイライト)。手・机と同じ-z側(顔の正面)に置く */}
      {[-1, 1].map((sign) => (
        <group key={sign} position={[sign * 0.15, 1.16, -0.34]}>
          <mesh>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0} />
          </mesh>
          <mesh position={[0, -0.005, -0.045]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color={PALETTE.ink} roughness={0.5} metalness={0} />
          </mesh>
          <mesh position={[0.015, 0.015, -0.075]}>
            <sphereGeometry args={[0.014, 6, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* 口 */}
      <mesh position={[0, 0.98, -0.385]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.12, 0.03, 0.02]} />
        <meshStandardMaterial color="#9c5a4a" roughness={0.7} metalness={0} />
      </mesh>

      {/* ほっぺ(ちょっとした赤み) */}
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[sign * 0.27, 1.02, -0.28]} rotation={[0, sign * 0.5, 0]}>
          <sphereGeometry args={[0.075, 10, 10]} />
          <meshStandardMaterial color="#e3a99a" roughness={0.9} metalness={0} transparent opacity={0.55} />
        </mesh>
      ))}

      {/* 腕: 肩→肘→机の上の手、という2関節で「机」側(-z方向)へ伸ばす */}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <mesh position={[sign * 0.36, 0.65, -0.08]} rotation={[0.8, 0, sign * 0.1]} material={bodyMaterial} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.15]} />
          </mesh>
          <mesh position={[sign * 0.32, 0.53, -0.23]} rotation={[1.15, 0, sign * 0.05]} material={bodyMaterial} castShadow>
            <boxGeometry args={[0.14, 0.26, 0.14]} />
          </mesh>
          {/* 手(机の上に置く) */}
          <mesh position={[sign * 0.28, 0.48, -0.32]} material={skinMaterial} castShadow>
            <sphereGeometry args={[0.1, 10, 10]} />
          </mesh>
        </group>
      ))}

      {/* 脚(靴先まで。机の陰に隠れる想定だが、形としては持たせる) */}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <mesh position={[sign * 0.16, 0.2, 0.05]} material={bodyMaterial} castShadow>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
          </mesh>
          <mesh position={[sign * 0.16, 0.02, 0.16]} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.32]} />
            <meshStandardMaterial color={SHOE_COLOR} roughness={0.9} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* 状態バッジ(blocked)。吹き出しが無い間、頭の脇に小さく表示し続ける */}
      {!bubble && state.event === "blocked" && (
        <Billboard position={[0.5, 1.5, 0]}>
          <StatusBadge text="!" bg="#fff3c4" fg="#8a5a00" border="#e0b23f" />
        </Billboard>
      )}

      {/* 吹き出し(実イベントのmessageを優先。無い間は面白いセリフを表示) */}
      {bubble && <SpeechBubble text={bubble} />}
      {!bubble && flavor && <SpeechBubble text={flavor} bg={FLAVOR_BG} />}
    </group>
  );
}

function StatusBadge({ text, bg, fg, border }: { text: string; bg: string; fg: string; border: string }) {
  return (
    <group>
      <mesh>
        <circleGeometry args={[0.16, 16]} />
        <meshStandardMaterial color={bg} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 0, -0.001]}>
        <ringGeometry args={[0.15, 0.17, 16]} />
        <meshStandardMaterial color={border} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.17} color={fg} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
}
