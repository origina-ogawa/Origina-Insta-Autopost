// 構成案作成(director.md相当)。一次ソースだけを根拠に8〜9枚のスライド構成を作らせる(末尾に固定のブランドスライドが1枚追加されるため、Instagramカルーセル上限10枚に収まるよう9枚までに制限。mechanical-check.mjsのCONTENT_SLIDE_MAXと合わせる)。
export function buildStructurePrompt(topic, sources) {
  const sourceList = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n');
  return `あなたはInstagramカルーセル投稿の構成作家です。次の一次ソースだけを根拠に、
8〜9枚のスライド構成案を考えてください。ここに無い情報を足してはいけません。

# テーマ
${topic.theme}

# 一次ソース
${sourceList}

# 構成の型
1枚目: フック(数字・意外性・問題提起のいずれかを含む)
2枚目: 前提の共有(なぜ今これが重要か)
3〜(N-1)枚目: 本文。1枚1メッセージ、詰め込まない
最終枚: まとめ+行動喚起

各スライドに、上記ソース番号(1〜${sources.length})を根拠として1つだけ紐付けてください。
紐付けられないスライドは作らないでください。

# 出力形式(JSON以外は出力しない)
{
  "slides": [
    { "role": "hook", "point": "このスライドで伝えること(1行)", "sourceIndex": 1 }
  ]
}`;
}

export async function buildStructure(topic, sources, { callGeminiJson }) {
  const prompt = buildStructurePrompt(topic, sources);
  const result = await callGeminiJson(prompt);
  const slides = result.slides;
  if (!Array.isArray(slides) || slides.length < 8 || slides.length > 9) {
    throw new Error(`構成案のスライド数が不正です(8〜9枚が必要、実際は${slides?.length ?? 0}枚)`);
  }
  return slides;
}
