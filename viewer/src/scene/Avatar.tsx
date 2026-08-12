import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { PALETTE } from "../theme";
import type { ActorState } from "../state/officeState";

const SHOE_COLOR = "#6B5638";
const IDLE_GRAY = "#B9B0A4";
const REJECT_RED = "#E14B3A";
const BUBBLE_MS = 4000;
const START_ANIM_MS = 450;
const REJECT_ANIM_MS = 700;

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ローポリのチビキャラをプリミティブだけで組み立てる(外部モデル不使用)。
// logs/SCHEMA.md の7イベントに応じて、着席の弾み(start)・吹き出し(progress/output/handoff/reject/blocked)・
// 赤フラッシュ(reject)・状態バッジ(blocked/done)を演出する。
export function Avatar({ color, state }: { color: string; state: ActorState }) {
  const bodyProps = { roughness: 0.8, metalness: 0 } as const;
  const skinProps = { color: PALETTE.skin, roughness: 0.75, metalness: 0 } as const;
  const bodyColor = state.active ? color : IDLE_GRAY;

  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh>(null);
  const flashMatRef = useRef<MeshStandardMaterial>(null);
  const startAnimStart = useRef<number | null>(null);
  const rejectAnimStart = useRef<number | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    if (state.seq === 0) return;
    if (state.event === "start") startAnimStart.current = performance.now();
    if (state.event === "reject") rejectAnimStart.current = performance.now();
    if (state.message) {
      setBubble(state.message);
      const id = setTimeout(() => setBubble(null), BUBBLE_MS);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq]);

  useFrame(() => {
    const now = performance.now();

    if (groupRef.current && startAnimStart.current !== null) {
      const t = Math.min(1, (now - startAnimStart.current) / START_ANIM_MS);
      groupRef.current.scale.setScalar(0.7 + 0.3 * easeOutBack(t));
      if (t >= 1) startAnimStart.current = null;
    }

    if (flashRef.current && flashMatRef.current) {
      if (rejectAnimStart.current !== null) {
        const t = Math.min(1, (now - rejectAnimStart.current) / REJECT_ANIM_MS);
        flashMatRef.current.opacity = Math.sin(t * Math.PI) * 0.6;
        flashRef.current.visible = true;
        if (t >= 1) rejectAnimStart.current = null;
      } else {
        flashRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.32, 0]}>
      {/* 胴体 */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.4]} />
        <meshStandardMaterial color={bodyColor} {...bodyProps} />
      </mesh>

      {/* reject時に一瞬だけ赤く光らせるオーバーレイ */}
      <mesh ref={flashRef} position={[0, 0.55, 0]} visible={false}>
        <boxGeometry args={[0.68, 0.68, 0.46]} />
        <meshStandardMaterial ref={flashMatRef} color={REJECT_RED} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 頭 */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial {...skinProps} />
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
          <mesh position={[sign * 0.36, 0.65, -0.08]} rotation={[0.8, 0, sign * 0.1]} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.15]} />
            <meshStandardMaterial color={bodyColor} {...bodyProps} />
          </mesh>
          <mesh position={[sign * 0.32, 0.53, -0.23]} rotation={[1.15, 0, sign * 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.26, 0.14]} />
            <meshStandardMaterial color={bodyColor} {...bodyProps} />
          </mesh>
          {/* 手(机の上に置く) */}
          <mesh position={[sign * 0.28, 0.48, -0.32]} castShadow>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial {...skinProps} />
          </mesh>
        </group>
      ))}

      {/* 脚(靴先まで。机の陰に隠れる想定だが、形としては持たせる) */}
      {[-1, 1].map((sign) => (
        <group key={sign}>
          <mesh position={[sign * 0.16, 0.2, 0.05]} castShadow>
            <boxGeometry args={[0.2, 0.4, 0.2]} />
            <meshStandardMaterial color={bodyColor} {...bodyProps} />
          </mesh>
          <mesh position={[sign * 0.16, 0.02, 0.16]} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.32]} />
            <meshStandardMaterial color={SHOE_COLOR} roughness={0.9} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* 状態バッジ(blocked/done)。吹き出しが無い間、頭の脇に小さく表示し続ける */}
      {!bubble && state.event === "blocked" && (
        <Billboard position={[0.5, 1.5, 0]}>
          <StatusBadge text="!" bg="#fff3c4" fg="#8a5a00" border="#e0b23f" />
        </Billboard>
      )}
      {!bubble && state.event === "done" && (
        <Billboard position={[0.5, 1.5, 0]}>
          <StatusBadge text="✓" bg="#eaf7ea" fg="#2f6b2f" border="#7fc77e" />
        </Billboard>
      )}

      {/* 吹き出し(message) */}
      {bubble && (
        <Billboard position={[0, 2.05, 0]}>
          <mesh>
            <planeGeometry args={[1.6, 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
          </mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.15} color={PALETTE.ink} anchorX="center" anchorY="middle" maxWidth={1.4}>
            {bubble}
          </Text>
        </Billboard>
      )}
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
