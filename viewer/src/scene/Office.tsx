import { Billboard, Text } from "@react-three/drei";
import {
  ACTORS,
  ACTOR_COLORS,
  ACTOR_LABELS,
  ACTOR_NAMES,
  DESK_POSITIONS,
  PALETTE,
  PRESIDENT_DESK_POSITION,
  PRESIDENT_LABEL,
  type ActorId,
} from "../theme";
import { Desk } from "./Desk";
import { Avatar } from "./Avatar";
import { OutputStack } from "./OutputStack";
import type { ActorState } from "../state/officeState";

// 顔にかぶらないよう、頭上ではなく机の手前側(客側の縁)に立てる名札。
// 全ての机は同じ向き(rotY: Math.PI)を共有しているが、Billboardにしておくことで
// 名札の文字面がカメラ(斜め見下ろしの固定アイソメ視点)に対して常に正対し、読みやすさを保てる
// (将来また机の向きがばらつく場合にも追従できる)。
// roleを渡すと「名前(大)+役職(小)」の2行表示、省略すると1行だけの中央表示になる
// (社長席のように役職が無い固定ラベルを表示する場合に使う)。
function NameSign({ name, role }: { name: string; role?: string }) {
  if (role) {
    // 2行表示: 名前1行+役職1行を収めるため、板を縦長(0.44)にし、1行表示より
    // Y位置を上げて(1.05)机の前面上端との間に十分なクリアランスを確保している。
    return (
      <Billboard position={[0, 1.05, -0.58]}>
        <mesh>
          <planeGeometry args={[0.9, 0.44]} />
          <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
        </mesh>
        <Text
          position={[0, 0.09, 0.01]}
          fontSize={0.19}
          color={PALETTE.ink}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.86}
        >
          {name}
        </Text>
        <Text
          position={[0, -0.1, 0.01]}
          fontSize={0.12}
          color={PALETTE.ink}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.86}
        >
          {role}
        </Text>
      </Billboard>
    );
  }

  // 1行表示: 社長席など役職の無い固定ラベル用。板は0.32、Y位置は元の0.98のまま。
  return (
    <Billboard position={[0, 0.98, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.32]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {name}
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
            <NameSign name={ACTOR_NAMES[actor]} role={ACTOR_LABELS[actor]} />
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
        <NameSign name={PRESIDENT_LABEL} />
      </group>
    </group>
  );
}
