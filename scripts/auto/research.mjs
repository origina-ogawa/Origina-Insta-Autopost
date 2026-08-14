// 一次ソース収集(researcher.md相当)。Gemini検索グラウンディングで探し、
// rubric/carousel.mdの「1-4 件数: 3件以上」を満たすかを判定する。
export function buildResearchPrompt(topic) {
  return `あなたはWeb制作会社のリサーチ担当です。次のテーマについて、直近14日以内に公開された
一次情報(公式ブログ・公式ドキュメント・論文・一次発表のいずれか。まとめ記事や個人の解説記事は不可)を
Google検索で調べ、3件以上見つけてください。

# テーマ
${topic.theme}
${topic.points ? `切り口の候補: ${topic.points}` : ''}

見つけた情報は、後続の担当者が読むための短いメモとして日本語200字程度で要約してください。`;
}

export function extractSources(groundingResult) {
  const seen = new Set();
  const sources = [];
  for (const s of groundingResult.sources || []) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push(s);
  }
  return sources;
}

export async function gatherSources(topic, { callGeminiGrounded }) {
  const prompt = buildResearchPrompt(topic);
  const result = await callGeminiGrounded(prompt);
  const sources = extractSources(result);
  return { sufficient: sources.length >= 3, sources, summary: result.text };
}
