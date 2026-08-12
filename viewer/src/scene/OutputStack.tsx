const PAPER_COLOR = "#FAF6EA";
const MAX_VISIBLE = 8;

// output イベントのたびに机の隅に紙が1枚増える(logs/SCHEMA.mdの「成果物モニターに追加」の3D側)。
// 積みすぎて破綻しないよう、見た目の枚数は上限を設ける。
export function OutputStack({ count }: { count: number }) {
  const visible = Math.min(count, MAX_VISIBLE);
  if (visible <= 0) return null;

  return (
    <group position={[0.55, 0.8, -0.2]}>
      {Array.from({ length: visible }, (_, i) => (
        <mesh key={i} position={[0, i * 0.025 + 0.012, 0]} castShadow>
          <boxGeometry args={[0.24, 0.02, 0.32]} />
          <meshStandardMaterial color={PAPER_COLOR} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
