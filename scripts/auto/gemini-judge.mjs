// 定性判定(inspector.md相当)。文字数など機械的に数えられる項目は mechanical-check.mjs が
// 担当済みのため、ここではrubric/carousel.mdのうち「1. 情報鮮度」「4. 表現の正確さ」など
// 判断が必要な項目だけをGeminiに判定させる。
export function buildJudgePrompt(slidesJson, sources, rubricMarkdown) {
  return `あなたは投稿の品質検収担当です。次のルーブリックのうち「1. 情報鮮度」「4. 表現の正確さ」の
項目だけを判定してください(文字数・枚数など機械的に数えられる項目は別途チェック済みのため対象外です)。
1項目でもNGがあれば全体を不合格としてください。

# ルーブリック
${rubricMarkdown}

# 一次ソース
${JSON.stringify(sources)}

# 検収対象
${JSON.stringify(slidesJson)}

# 出力形式(JSON以外は出力しない)
{ "ok": true, "reasons": [] }

不合格の場合は "ok": false とし、"reasons" に「どのスライドの何が問題か」を日本語で具体的に書いてください。`;
}

export async function judgeContent(slidesJson, sources, rubricMarkdown, { callGeminiJson }) {
  const prompt = buildJudgePrompt(slidesJson, sources, rubricMarkdown);
  return callGeminiJson(prompt);
}
