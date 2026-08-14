// 文言清書(producer.md相当)。構成案をもとに、producer.mdと同じslides.jsonスキーマで
// 文言をGeminiに書かせる。不合格で差し戻された場合はrejectionReasonsに理由を積んで再生成する。
export function buildCopyPrompt(topic, structure, sources, tokens, rejectionReasons = []) {
  const sourceList = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n');
  const structureList = structure
    .map((s, i) => `${i + 1}. [${s.role}] ${s.point}(根拠: ソース${s.sourceIndex})`)
    .join('\n');
  const retryNote = rejectionReasons.length
    ? `\n# 前回の差し戻し理由(必ず直すこと)\n${rejectionReasons.map((r) => `- ${r}`).join('\n')}\n`
    : '';

  return `あなたはWeb制作会社のSNS担当です。次の構成案をもとに、Instagramカルーセル投稿の
文言を清書してください。

# テーマ
${topic.theme}

# 一次ソース
${sourceList}

# 構成案
${structureList}
${retryNote}
# 文字数の上限(厳守。超えたら書き直す。フォントを縮めることでは解決しない)
- 見出し: ${tokens.font.heading.maxChars}字以内
- 本文: ${tokens.font.body.maxChars}字以内
- 1スライドの合計(見出し+本文): ${tokens.limits.slideTotalChars}字以内

# ルール
- 1スライド1メッセージ
- 未確定情報には「〜とされています」「〜と発表されました」の留保をつける
- 断定してよいのはソースで確定と分類されたものだけ
- hashtagsは3個以内、関連性の高いものだけ厳選する
- source_refには、そのスライドの根拠にした一次ソースのURLをそのまま入れる

# 出力形式(JSON以外は出力しない)
{
  "slug": "半角英数とハイフンだけの短いスラッグ",
  "caption": "投稿本文(300〜500文字)",
  "hashtags": ["#タグ1", "#タグ2", "#タグ3"],
  "sources": [${sources.map((s) => `"${s.url}"`).join(', ')}],
  "slides": [
    { "no": 1, "heading": "", "body": "", "source_ref": "" }
  ]
}`;
}

export async function writeSlides(topic, structure, sources, tokens, { callGeminiJson }, rejectionReasons = []) {
  const prompt = buildCopyPrompt(topic, structure, sources, tokens, rejectionReasons);
  return callGeminiJson(prompt);
}
