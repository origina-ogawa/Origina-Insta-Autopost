// Gemini APIを直接呼ぶ薄いラッパー。JSON生成モードと検索グラウンディングモードの2種類を提供する。
// リトライ・JSON抽出のロジックは src/generate.js の callGemini() と同じ考え方(設計書の決定により
// generate.js自体は変更せず、こちらは自動投稿パイプライン専用として複製する)。
// JSON解析・応答テキスト抽出はリトライ対象の関数の「中」で行う(src/generate.jsと同じ構造)。
// そうしないと、Geminiが一時的に壊れたJSONや空応答を返したときにリトライされず、
// 無人実行(GitHub Actions)ではその日1回の失敗がそのまま丸ごと投稿見送りになってしまうため。
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

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

function extractText(data) {
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Geminiの応答が空です(finishReason: ${candidate?.finishReason ?? '不明'})`);
  return { text, candidate };
}

// actionは1回分の「リクエスト+結果の解釈」をまとめた非同期関数。JSON解析などの失敗も
// action の中で発生させることで、リトライの対象に含める(src/generate.jsと同じ考え方)。
async function withRetry(action, attempts) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await action();
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isRetryable(e)) throw e;
      const waitMs = 2000 * 2 ** (i - 1);
      console.warn(`Gemini呼び出し失敗(${i}/${attempts}回目、${waitMs}ms後に再試行): ${e.message}`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

export async function callGeminiJson(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  return withRetry(async () => {
    const data = await requestOnce({ prompt, apiKey, model });
    const { text } = extractText(data);
    try {
      return JSON.parse(extractFirstJsonObject(text));
    } catch (e) {
      const outDir = path.join(ROOT, 'output');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'debug-raw-response.txt'), text);
      throw new Error(`JSON解析に失敗しました(output/debug-raw-response.txt に生データを保存): ${e.message}`);
    }
  }, attempts);
}

export async function callGeminiGrounded(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  return withRetry(async () => {
    const data = await requestOnce({ prompt, apiKey, model, tools: [{ google_search: {} }] });
    const { text, candidate } = extractText(data);
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c) => c.web && { url: c.web.uri, title: c.web.title }).filter(Boolean);
    return { text, sources };
  }, attempts);
}
