// 吹き出しの板(plane)サイズを、テキストの文字幅から見積もる。
// drei の <Text> は maxWidth で自動折り返しするため、ここで求めた maxTextWidth を
// Text の maxWidth に渡すことで、板のサイズと折り返し行数の見積もりを一致させる。
// 全角文字(ひらがな・カタカナ・漢字・全角記号)は半角文字より幅を取るため、
// 文字ごとに重みを分けて幅を見積もる簡易ヒューリスティックであり、
// ピクセル単位で正確な計算ではない点に注意(視覚確認で十分な余裕を持たせている)。
const FULLWIDTH_UNIT = 0.17; // 全角1文字あたりの目安幅(fontSize 0.15+字間の余裕)
const HALFWIDTH_WEIGHT = 0.55; // 半角文字の重み(全角=1.0との相対値)
const H_PADDING = 0.3; // 左右の余白合計
const V_PADDING = 0.22; // 上下の余白合計
const LINE_HEIGHT = 0.2;
const MIN_WIDTH = 1.0;
const MAX_WIDTH = 2.6;

export type BubbleSize = { width: number; height: number; maxTextWidth: number };

// 1行分の最小高さ(0.42)。SpeechBubble側で「吹き出しの下端(しっぽ側)を固定し、
// 行数が増えた分だけ上方向に伸ばす」ための基準値として使う。
export const MIN_BUBBLE_HEIGHT = LINE_HEIGHT + V_PADDING;

// 全角判定: ひらがな・カタカナ・全角記号(0x3000-0x30FF)、漢字(0x4E00-0x9FFF)、
// 全角英数・記号(0xFF00-0xFF60)、全角記号の一部(0xFFE0-0xFFE6)を全角とみなす。
// それ以外(半角英数・半角記号など)は半角として扱う。
function isFullWidth(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x3000 && code <= 0x30ff) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function weightedLength(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += isFullWidth(ch) ? 1 : HALFWIDTH_WEIGHT;
  }
  return w;
}

export function computeBubbleSize(text: string): BubbleSize {
  const wLen = weightedLength(text);
  const rawWidth = wLen * FULLWIDTH_UNIT + H_PADDING;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawWidth));
  const maxTextWidth = width - H_PADDING;
  const charsPerLine = Math.max(0.001, maxTextWidth / FULLWIDTH_UNIT);
  const lineCount = Math.max(1, Math.ceil(wLen / charsPerLine));
  const height = lineCount * LINE_HEIGHT + V_PADDING;
  return { width, height, maxTextWidth };
}
