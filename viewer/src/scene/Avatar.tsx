import { PALETTE } from "../theme";

const SHOE_COLOR = "#6B5638";

// ローポリのチビキャラをプリミティブだけで組み立てる(外部モデル不使用)。
// 顔(目・口・ほっぺ)と、机に手を乗せた腕、靴先までの脚を持たせる。
// このステップではアニメーションなし、全員着席の静止ポーズのみ。
export function Avatar({ color }: { color: string }) {
  const bodyProps = { roughness: 0.8, metalness: 0 } as const;
  const skinProps = { color: PALETTE.skin, roughness: 0.75, metalness: 0 } as const;

  return (
    // 机の天板より上に胸元が出るよう、着席位置を少し高めにする
    <group position={[0, 0.32, 0]}>
      {/* 胴体 */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.4]} />
        <meshStandardMaterial color={color} {...bodyProps} />
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
            <meshStandardMaterial color={color} {...bodyProps} />
          </mesh>
          <mesh position={[sign * 0.32, 0.53, -0.23]} rotation={[1.15, 0, sign * 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.26, 0.14]} />
            <meshStandardMaterial color={color} {...bodyProps} />
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
            <meshStandardMaterial color={color} {...bodyProps} />
          </mesh>
          <mesh position={[sign * 0.16, 0.02, 0.16]} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.32]} />
            <meshStandardMaterial color={SHOE_COLOR} roughness={0.9} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
