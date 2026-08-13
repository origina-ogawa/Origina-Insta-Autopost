// 参考画像(assets/mirai01.png, assets/mirai-ad.png)をもとに、同一人物・同一服装でポーズ違いの
// 画像を6枚生成し、assets/character/ に保存する。自動投稿フローには含まれない、手動の一回限りスクリプト。
// 使い方:
//   node scripts/generate-character-poses.mjs          … 6枚すべて生成
//   node scripts/generate-character-poses.mjs --pose 3 … 3番目のポーズだけ再生成
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/character');
const REFERENCE_IMAGES = ['assets/mirai01.png', 'assets/mirai-ad.png'];

const POSES = [
  { id: 1, text: 'お辞儀をしながら笑顔で挨拶しているポーズ' },
  { id: 2, text: '人差し指でカメラ側を指さしているポーズ' },
  { id: 3, text: '両手を軽く広げて説明しているジェスチャー' },
  { id: 4, text: '片手で親指を立てているポーズ' },
  { id: 5, text: 'メモボードのようなものを胸の高さで提示しているポーズ' },
  { id: 6, text: '腕を組んで考えているポーズ' },
];

const IDENTITY_PROMPT = `添付の参考画像と同一人物として、新しいポーズの写真を1枚生成してください。

厳守してください:
- 髪型・髪色・メイク・顔立ちは参考画像と完全に同一にする
- 服装(ベージュのテーラードジャケット、白いインナー、ワインレッドのタイトスカート、パールピアス)も参考画像と完全に同一にする
- 背景は無地の白(#FFFFFF)一色。スタジオ機材・家具・小物は写り込ませない
- 構図はバストアップ〜ニーアップの縦長ポートレート、1人のみ
- 表情は明るい笑顔基調

今回のポーズ: {POSE}

出力は画像のみ。説明文は不要です。`;

function readImageBase64(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath)).toString('base64');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini APIは一時的な過負荷(429/5xx)で失敗することがあるためリトライする(src/generate.jsと同じ方針)。
function isRetryable(err) {
  if (err.status === 429 || err.status >= 500) return true;
  if (!err.status) return true;
  return false;
}

async function callGeminiImageOnce(promptText) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const parts = [
    { text: promptText },
    ...REFERENCE_IMAGES.map((p) => ({ inline_data: { mime_type: 'image/png', data: readImageBase64(p) } })),
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
    }),
  });
  if (!res.ok) {
    const err = new Error(`Gemini画像生成APIエラー: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function callGeminiImage(promptText, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await callGeminiImageOnce(promptText);
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

function extractImagePart(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData;
    if (part.inline_data?.data) return part.inline_data;
  }
  return null;
}

async function generatePose(pose) {
  const promptText = IDENTITY_PROMPT.replace('{POSE}', pose.text);
  console.log(`ポーズ${pose.id}を生成中: ${pose.text}`);
  const data = await callGeminiImage(promptText);
  const image = extractImagePart(data);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!image) {
    const debugPath = path.join(OUT_DIR, `debug-raw-response-pose${pose.id}.json`);
    fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
    throw new Error(`ポーズ${pose.id}: 画像データが応答に含まれていません(${debugPath} に生データを保存)`);
  }
  const ext = image.mimeType?.includes('png') ? 'png' : 'jpg';
  const outPath = path.join(OUT_DIR, `pose-${String(pose.id).padStart(2, '0')}.${ext}`);
  fs.writeFileSync(outPath, Buffer.from(image.data, 'base64'));
  console.log(`保存: ${path.relative(ROOT, outPath)}`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY が設定されていません');
  const poseArgIndex = process.argv.indexOf('--pose');
  const targetId = poseArgIndex !== -1 ? Number(process.argv[poseArgIndex + 1]) : null;
  const targets = targetId ? POSES.filter((p) => p.id === targetId) : POSES;
  if (targetId && targets.length === 0) throw new Error(`--pose ${targetId} は存在しません(1〜${POSES.length}を指定してください)`);

  for (const pose of targets) {
    await generatePose(pose);
  }
  console.log(`完了: ${targets.length}枚のポーズ画像を生成しました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
