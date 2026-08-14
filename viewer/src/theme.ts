// アートディレクション: 和室オフィスのジオラマ。低彩度の暖色ニュートラルで統一し、
// 金属光沢・強い反射は使わない(roughness高め・metalness 0のマット質感)。
export const PALETTE = {
  floor: "#E8E0D3", // 畳/生成り色の床
  floorEdge: "#8C7B5E", // 畳の縁(低彩度のカーキ)
  wood: "#B08D5E", // 木製デスク
  woodDark: "#8C6F45", // デスクの脚・影側
  wall: "#F2EDE4", // 壁(和紙の質感を意識した生成り)
  wallShoji: "#EDE6D8", // 障子風のアクセントパネル
  skin: "#F0DCC0", // キャラクターの肌
  ink: "#4A3B2A", // 目・文字などの濃い色
} as const;

export type ActorId = "pm" | "researcher" | "director" | "producer" | "inspector" | "publisher";

export const ACTORS: ActorId[] = ["pm", "researcher", "director", "producer", "inspector", "publisher"];

export const ACTOR_LABELS: Record<ActorId, string> = {
  pm: "PM",
  researcher: "リサーチ",
  director: "ディレクター",
  producer: "制作",
  inspector: "目利き",
  publisher: "配信",
};

// キャラクターごとの差し色。全体のニュートラルな低彩度パレットに合わせて彩度を抑える。
export const ACTOR_COLORS: Record<ActorId, string> = {
  pm: "#BFA46A",
  researcher: "#7FA6A0",
  director: "#C98B5D",
  producer: "#8FA37A",
  inspector: "#A98CA0",
  publisher: "#C98C93",
};

// 半円状のオフィスレイアウト。pm は最奥中央で全体を見渡す配置。
export const DESK_POSITIONS: Record<ActorId, { x: number; z: number; rotY: number }> = {
  pm: { x: 0, z: -6.5, rotY: Math.PI },
  researcher: { x: -6.2, z: -1, rotY: Math.PI * 0.7 },
  director: { x: -3.4, z: 1.8, rotY: Math.PI * 0.85 },
  producer: { x: 0, z: 2.8, rotY: Math.PI },
  inspector: { x: 3.4, z: 1.8, rotY: -Math.PI * 0.85 },
  publisher: { x: 6.2, z: -1, rotY: -Math.PI * 0.7 },
};

// logs/SCHEMA.md に明示的な宛先フィールドが無いため、固定の幕の流れから推測する。
// handoff(次の社員へ)と reject(差し戻し先へ)の両方向で使う。
export const PIPELINE_NEXT: Record<ActorId, ActorId | null> = {
  pm: null,
  researcher: "director",
  director: "producer",
  producer: "inspector",
  inspector: "publisher",
  publisher: null,
};

export const PIPELINE_PREV: Record<ActorId, ActorId | null> = {
  pm: null,
  researcher: null,
  director: "researcher",
  producer: "director",
  inspector: "producer",
  publisher: "inspector",
};

/** actorから見たtargetの方向を、actor自身のローカル座標系(机の正面=-z)に変換した単位ベクトル */
function localDirectionTo(actor: ActorId, target: ActorId | null): { x: number; z: number } | null {
  if (!target) return null;
  const from = DESK_POSITIONS[actor];
  const to = DESK_POSITIONS[target];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const ndx = dx / len;
  const ndz = dz / len;
  const theta = from.rotY;
  return {
    x: ndx * Math.cos(theta) - ndz * Math.sin(theta),
    z: ndx * Math.sin(theta) + ndz * Math.cos(theta),
  };
}

// handoffで少し身を乗り出す方向(次の社員側)/rejectで少し向き直る方向(差し戻し先側)。
// 起動時に一度だけ計算する(机の配置は固定のため)。
export const LEAN_TO_NEXT: Record<ActorId, { x: number; z: number } | null> = Object.fromEntries(
  ACTORS.map((actor) => [actor, localDirectionTo(actor, PIPELINE_NEXT[actor])]),
) as Record<ActorId, { x: number; z: number } | null>;

export const LEAN_TO_PREV: Record<ActorId, { x: number; z: number } | null> = Object.fromEntries(
  ACTORS.map((actor) => [actor, localDirectionTo(actor, PIPELINE_PREV[actor])]),
) as Record<ActorId, { x: number; z: number } | null>;

// 出社/退社アニメーションで歩いていくワールド空間の方向。机が中心より左の社員は左へ、
// 右の社員は右へ歩く。中央寄り(pm, producer)は右に固定する。
const EXIT_WORLD_DIR: Record<ActorId, { x: number; z: number }> = Object.fromEntries(
  ACTORS.map((actor) => [actor, DESK_POSITIONS[actor].x < 0 ? { x: -1, z: 0 } : { x: 1, z: 0 }]),
) as Record<ActorId, { x: number; z: number }>;

// 出社/退社の方向を、社員自身のローカル座標系(机の正面=-z)に変換した単位ベクトル。
// LEAN_TO_NEXT/LEAN_TO_PREVと同じ変換(localDirectionTo)を、固定のワールド方向に対して適用する。
export const WALK_DIR: Record<ActorId, { x: number; z: number }> = Object.fromEntries(
  ACTORS.map((actor) => {
    const theta = DESK_POSITIONS[actor].rotY;
    const world = EXIT_WORLD_DIR[actor];
    return [
      actor,
      {
        x: world.x * Math.cos(theta) - world.z * Math.sin(theta),
        z: world.x * Math.sin(theta) + world.z * Math.cos(theta),
      },
    ];
  }),
) as Record<ActorId, { x: number; z: number }>;
