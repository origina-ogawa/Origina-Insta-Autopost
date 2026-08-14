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

// 職業から連想した個人名(ひらがな表記)。3Dの名札は小さいため視認性を優先し、
// 漢字ではなくひらがなで表示する(由来は下記コメント参照)。
export const ACTOR_NAMES: Record<ActorId, string> = {
  pm: "つかさ", // 司 - 全体を取り仕切る役
  researcher: "あかり", // 灯 - 情報を照らして見つけ出す役
  director: "ゆい", // 結 - ソースを構成として結びつける役
  producer: "たくみ", // 匠 - 手を動かして作り上げる役
  inspector: "さえ", // 冴 - 鋭く厳しい目でチェックする役
  publisher: "つばさ", // 翼 - 世の中へ送り出す役
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

// 横3×縦2のグリッド配置。全員カメラの方(rotY: Math.PI)を向く。
// 奥列(z=-3.5): researcher→director→producer(幕1〜3の順)
// 手前列(z=1.0): inspector→publisher→pm(幕4〜5+PM)
export const DESK_POSITIONS: Record<ActorId, { x: number; z: number; rotY: number }> = {
  researcher: { x: -3.6, z: -3.5, rotY: Math.PI },
  director: { x: 0, z: -3.5, rotY: Math.PI },
  producer: { x: 3.6, z: -3.5, rotY: Math.PI },
  inspector: { x: -3.6, z: 1.0, rotY: Math.PI },
  publisher: { x: 0, z: 1.0, rotY: Math.PI },
  pm: { x: 3.6, z: 1.0, rotY: Math.PI },
};

// 社長席(ユーザーを表す飾りの机)。PMの旧位置(半円配置時の奥中央)を踏襲しつつ、
// x=1.8はディレクター席の吹き出し・producer列との視覚的な重なりを避けるための調整値
// (カメラがx=+2寄りにあるため、ディレクター列とproducer列の間の隙間に収まる)。
export const PRESIDENT_DESK_POSITION = { x: 1.8, z: -6.5, rotY: Math.PI };

// 社長席の名札に表示するラベル(AI社員以外の唯一の固定ラベル)。
export const PRESIDENT_LABEL = "社長";

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
// それ以外(x=0の中央列を含む)は右へ歩く。机がx=0(中央列)の場合はelse分岐で右へ
// 出社/退社する(中央より左の列だけが左へ出る)。
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

// 出社/退社の歩行距離。壁(x=±9)を確実に越えるよう、全社員が同じワールドX(±11)へ到達する距離にする。
export const WALK_DISTANCE: Record<ActorId, number> = Object.fromEntries(
  ACTORS.map((actor) => [actor, 11 - Math.abs(DESK_POSITIONS[actor].x)]),
) as Record<ActorId, number>;
