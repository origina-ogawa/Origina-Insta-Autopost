// 吹き出しの板(plane)サイズを、テキストの文字数から見積もる。
// drei の <Text> は maxWidth で自動折り返しするため、ここで求めた maxTextWidth を
// Text の maxWidth に渡すことで、板のサイズと折り返し行数の見積もりを一致させる。
// 全角(日本語)・半角混在を厳密には区別しない簡易ヒューリスティックであり、
// ピクセル単位で正確な計算ではない点に注意(視覚確認で十分な余裕を持たせている)。
const CHAR_WIDTH = 0.1; // 1文字あたりの目安幅(fontSize 0.15基準)
const H_PADDING = 0.3; // 左右の余白合計
const V_PADDING = 0.22; // 上下の余白合計
const LINE_HEIGHT = 0.2;
const MIN_WIDTH = 1.0;
const MAX_WIDTH = 2.6;

export type BubbleSize = { width: number; height: number; maxTextWidth: number };

export function computeBubbleSize(text: string): BubbleSize {
  const rawWidth = text.length * CHAR_WIDTH + H_PADDING;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawWidth));
  const maxTextWidth = width - H_PADDING;
  const charsPerLine = Math.max(1, Math.floor(maxTextWidth / CHAR_WIDTH));
  const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
  const height = lineCount * LINE_HEIGHT + V_PADDING;
  return { width, height, maxTextWidth };
}
