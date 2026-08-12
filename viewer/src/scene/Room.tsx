import type { ReactNode } from "react";
import { PALETTE } from "../theme";

const ROOM_SIZE = 18;
const WALL_HEIGHT = 5;

// 畳の目地を表す簡易グリッド(和紙質感の床の上に低ポリの区切り線を重ねるだけ)
function TatamiGrid() {
  const lines: ReactNode[] = [];
  const step = 2.2;
  const half = ROOM_SIZE / 2;
  let i = 0;
  for (let x = -half; x <= half; x += step) {
    lines.push(
      <mesh key={`v-${i++}`} position={[x, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, ROOM_SIZE]} />
        <meshStandardMaterial color={PALETTE.floorEdge} roughness={1} metalness={0} />
      </mesh>,
    );
  }
  for (let z = -half; z <= half; z += step) {
    lines.push(
      <mesh key={`h-${i++}`} position={[0, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_SIZE, 0.04]} />
        <meshStandardMaterial color={PALETTE.floorEdge} roughness={1} metalness={0} />
      </mesh>,
    );
  }
  return <group>{lines}</group>;
}

// あつまれどうぶつの森やドラクエのような、和室オフィスのジオラマ部屋。
// 金属光沢・強い反射は使わず、roughness高め/metalness 0のマット質感に統一する。
export function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.95} metalness={0} />
      </mesh>
      <TatamiGrid />

      <mesh position={[0, WALL_HEIGHT / 2, -ROOM_SIZE / 2]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={1} metalness={0} side={2} />
      </mesh>
      <mesh position={[-ROOM_SIZE / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={1} metalness={0} side={2} />
      </mesh>
      <mesh position={[ROOM_SIZE / 2, WALL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={1} metalness={0} side={2} />
      </mesh>

      {/* 障子風のアクセントパネル(奥の壁) */}
      {[-5, 5].map((x) => (
        <mesh key={x} position={[x, 3, -ROOM_SIZE / 2 + 0.03]}>
          <planeGeometry args={[2.6, 2]} />
          <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
