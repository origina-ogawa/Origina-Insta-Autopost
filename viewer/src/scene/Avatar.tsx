import { PALETTE } from "../theme";

// ローポリのチビキャラをプリミティブだけで組み立てる(外部モデル不使用)。
// このステップではアニメーションなし、全員着席の静止ポーズのみ。
export function Avatar({ color }: { color: string }) {
  const bodyProps = { roughness: 0.8, metalness: 0 } as const;
  const skinProps = { color: PALETTE.skin, roughness: 0.75, metalness: 0 } as const;

  return (
    // 机の天板より上に胸元が出るよう、着席位置を少し高めにする
    <group position={[0, 0.32, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.4]} />
        <meshStandardMaterial color={color} {...bodyProps} />
      </mesh>

      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial {...skinProps} />
      </mesh>

      <mesh position={[-0.14, 1.17, 0.36]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={PALETTE.ink} roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0.14, 1.17, 0.36]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={PALETTE.ink} roughness={0.6} metalness={0} />
      </mesh>

      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[sign * 0.36, 0.6, 0]} rotation={[0, 0, sign * 0.15]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color={color} {...bodyProps} />
        </mesh>
      ))}

      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[sign * 0.16, 0.2, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.4, 0.2]} />
          <meshStandardMaterial color={color} {...bodyProps} />
        </mesh>
      ))}
    </group>
  );
}
