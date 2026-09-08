// 一次ソース収集(researcher.md相当)。Gemini検索グラウンディングで探し、
// rubric/carousel.mdの「1-4 件数: 3件以上」を満たすかを判定する。
//
// 重要: Geminiのgoogle_searchグラウンディングのgroundingChunksにはURL/titleしか
// 含まれず、公開日は入っていない。そのためinspector(gemini-judge.mjs)には常に
// 「公開日が確認できない」情報しか渡っておらず、rubricの1-2(公開日 14日以内)に
// 必ず引っかかっていた(2026-08-17以降の自動実行が全て自己検収で見送りになっていた原因)。
// ここで各ソースを実際に取得し、公開日をページから確認したものだけを残す。
export function buildResearchPrompt(topic) {
  return `あなたはWeb制作会社のリサーチ担当です。次のテーマについて、直近14日以内に公開された
一次情報(公式ブログ・公式ドキュメント・論文・一次発表のいずれか。まとめ記事や個人の解説記事は不可)を
Google検索で調べ、6件以上見つけてください(後工程で公開日が確認できないものは除外されるため、
必要数の3件より多めに集めてください)。

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

const DATE_PATTERNS = [
  /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
  /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+name=["'](?:date|dc\.date|dcterms\.date)["'][^>]+content=["']([^"']+)["']/i,
  /"datePublished"\s*:\s*"([^"]+)"/i,
  /<time[^>]+datetime=["']([^"']+)["']/i,
];

// ページ本体を取得し、代表的なメタタグ/JSON-LDから公開日(ISO文字列)を読み取る。
// 取得・解析に失敗した場合はnull(=公開日不明として後段でふるい落とす)。
export async function fetchPublishedDate(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OriginaResearchBot/1.0)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    for (const pattern of DATE_PATTERNS) {
      const match = html.match(pattern);
      if (!match) continue;
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

function isWithinDays(isoDate, days) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= days * 24 * 60 * 60 * 1000;
}

export async function gatherSources(
  topic,
  { callGeminiGrounded, fetchPublishedDate: fetchDate = fetchPublishedDate, freshnessDays = 14 }
) {
  const prompt = buildResearchPrompt(topic);
  const result = await callGeminiGrounded(prompt);
  const candidates = extractSources(result);
  const dated = await Promise.all(
    candidates.map(async (s) => ({ ...s, publishedAt: await fetchDate(s.url) }))
  );
  const sources = dated.filter((s) => s.publishedAt && isWithinDays(s.publishedAt, freshnessDays));
  return { sufficient: sources.length >= 3, sources, summary: result.text };
}
