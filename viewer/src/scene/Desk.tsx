import { PALETTE } from "../theme";

// 木製デスク。マット質感(roughness高め・metalness 0)で統一する。
export function Desk() {
  return (
    <group>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.1, 0.9]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.85} metalness={0} />
      </mesh>
      {(
        [
          [-0.7, 0.375, -0.38],
          [0.7, 0.375, -0.38],
          [-0.7, 0.375, 0.38],
          [0.7, 0.375, 0.38],
        ] as const
      ).map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} castShadow>
          <boxGeometry args={[0.08, 0.75, 0.08]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={0.85} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
