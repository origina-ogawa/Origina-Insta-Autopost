// Gemini APIを直接呼ぶ薄いラッパー。JSON生成モードと検索グラウンディングモードの2種類を提供する。
// リトライ・JSON抽出のロジックは src/generate.js の callGemini() と同じ考え方(設計書の決定により
// generate.js自体は変更せず、こちらは自動投稿パイプライン専用として複製する)。
import 'dotenv/config';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err) {
  if (err.status === 429 || err.status >= 500) return true;
  if (!err.status) return true;
  return false;
}

// Geminiが末尾に余分な文字を付けることがあるため、最初の "{" から対応する "}" までだけを取り出す。
export function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

async function requestOnce({ prompt, tools, apiKey, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (tools) body.tools = tools;
  else body.generationConfig = { responseMimeType: 'application/json', temperature: 0.9 };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini APIエラー: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function requestWithRetry(opts, attempts) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await requestOnce(opts);
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isRetryable(e)) throw e;
      console.warn(`Gemini呼び出し失敗(${i}/${attempts}回目、リトライします): ${e.message}`);
      await sleep(2000 * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

function extractText(data) {
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Geminiの応答が空です(finishReason: ${candidate?.finishReason ?? '不明'})`);
  return { text, candidate };
}

export async function callGeminiJson(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  const data = await requestWithRetry({ prompt, apiKey, model }, attempts);
  const { text } = extractText(data);
  return JSON.parse(extractFirstJsonObject(text));
}

export async function callGeminiGrounded(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  const data = await requestWithRetry({ prompt, apiKey, model, tools: [{ google_search: {} }] }, attempts);
  const { text, candidate } = extractText(data);
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c.web && { url: c.web.uri, title: c.web.title }).filter(Boolean);
  return { text, sources };
}
