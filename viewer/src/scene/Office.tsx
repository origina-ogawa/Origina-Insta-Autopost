import { Billboard, Text } from "@react-three/drei";
import {
  ACTORS,
  ACTOR_COLORS,
  ACTOR_LABELS,
  ACTOR_NAMES,
  DESK_POSITIONS,
  PALETTE,
  PRESIDENT_DESK_POSITION,
  type ActorId,
} from "../theme";
import { Desk } from "./Desk";
import { Avatar } from "./Avatar";
import { OutputStack } from "./OutputStack";
import type { ActorState } from "../state/officeState";

// 顔にかぶらないよう、頭上ではなく机の手前側(客側の縁)に立てる名札。
// 机ごとに向きが異なるため、常にカメラの方を向くBillboardにして文字が裏返らないようにする
function NameSign({ actor }: { actor: (typeof ACTORS)[number] }) {
  return (
    <Billboard position={[0, 1.0, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.44]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0.09, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {ACTOR_NAMES[actor]}
      </Text>
      <Text position={[0, -0.1, 0.01]} fontSize={0.12} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {ACTOR_LABELS[actor]}
      </Text>
    </Billboard>
  );
}

// 社長席の名札。AI社員の名札とは違い役職の2行目は無く、常に「社長」とだけ表示する。
function PresidentNameSign() {
  return (
    <Billboard position={[0, 0.98, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.32]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        社長
      </Text>
    </Billboard>
  );
}

// 横3×縦2のグリッドに並んだ6卓+社長席のオフィス。logs/events.jsonl の状態に応じて各社員が反応する。
export function Office({
  actors,
  batchCount,
}: {
  actors: Record<ActorId, ActorState>;
  batchCount: number;
}) {
  return (
    <group>
      {ACTORS.map((actor) => {
        const pos = DESK_POSITIONS[actor];
        return (
          <group key={actor} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]}>
            <Desk />
            <NameSign actor={actor} />
            <OutputStack count={actors[actor].outputCount} />
            <group position={[0, 0, 0.55]}>
              <Avatar actor={actor} color={ACTOR_COLORS[actor]} state={actors[actor]} batchCount={batchCount} />
            </group>
          </group>
        );
      })}
      <group
        position={[PRESIDENT_DESK_POSITION.x, 0, PRESIDENT_DESK_POSITION.z]}
        rotation={[0, PRESIDENT_DESK_POSITION.rotY, 0]}
      >
        <Desk />
        <PresidentNameSign />
      </group>
    </group>
  );
}
