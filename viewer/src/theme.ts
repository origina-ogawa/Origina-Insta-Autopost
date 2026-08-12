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
