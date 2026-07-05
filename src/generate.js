// 今日のテーマを選び、Gemini APIでスライド文章(post.json)を生成する。
// 使い方:
//   node src/generate.js          … Gemini APIで生成(要 GEMINI_API_KEY)
//   node src/generate.js --mock   … APIを呼ばず固定データで生成(テスト用・無料)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { iconListForPrompt } from './lib/icons.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const BRAND = process.env.BRAND || 'own';

function pickTopic() {
  const { topics } = yaml.load(fs.readFileSync(path.join(ROOT, 'topics.yml'), 'utf8'));
  if (!topics?.length) throw new Error('topics.yml にテーマがありません');
  // 日数ベースのローテーション(状態管理不要。リストを使い切ると先頭に戻る)
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  return topics[dayNumber % topics.length];
}

function buildPrompt(topic, brand) {
  return `あなたは日本のWeb制作会社のSNS担当です。Instagramカルーセル投稿(教育系・お役立ち系)の原稿を作ってください。

# トーン
${brand.tone}

# 今日のテーマ
${topic.theme}
${topic.points ? `切り口の候補: ${topic.points}` : ''}

# 出力形式
必ず次のJSON構造だけを出力してください(説明文やコードブロック記号は不要)。

{
  "caption": "投稿本文。300〜500文字。冒頭1行で興味を引き、絵文字は控えめに。最後に保存を促す一言",
  "hashtags": ["#タグ1", "#タグ2"],  // 10〜15個。ビッグタグとスモールタグを混ぜる
  "slides": [
    { "type": "cover", "title_lines": ["1行目", "2行目", "3行目"], "marker_line": 0, "icon": "ti-devices" },
    { "type": "body", "number": "01", "title": "==強調部分==を含む見出し", "sub": "補足1〜2行", "icon": "ti-mail-x",
      "blocks": [
        { "type": "lead", "icon": "ti-alert-circle", "title": "それ、**要注意**です!", "text": "本文80〜120文字",
          "compare": { "left": {"icon": "ti-template", "label": "悪い例\\n(補足)"}, "right": {"icon": "ti-target-arrow", "label": "良い例\\n(補足)"} } },
        { "type": "checklist", "header": "こんな**リスク**があります",
          "items": [ {"icon": "ti-lock", "text": "項目。**強調**を1箇所"}, {"icon": "ti-users", "text": "..."} ] }
      ],
      "note": "このスライドのまとめ1文。**強調**を1箇所", "note_icon": "ti-file-search" },
    { "type": "summary", "title": "まとめ", "items": [ {"icon": "ti-check", "text": "要点1"} ],
      "cta": "行動を促す1文" }
  ]
}

# ルール
- slidesは「cover 1枚 → body 3〜4枚 → summary 1枚」の合計5〜6枚
- coverのtitle_linesは1行8文字以内で2〜4行。**装飾記法(**/==)は使わない**、プレーンな文字列のみ。黄色マーカーは marker_line(行番号・0始まり)で指定する
- bodyのblocksは**必ず各スライド2個(1個や3個は不可)**。組み合わせ例: lead+checklist、paragraph+checklist、lead+compare など毎回変化をつける
- checklistのitemsは3〜4個。iconは項目の内容に合ったものを選ぶ
- 強調記法: **文字** = 赤字強調 / ==文字== = 黄色マーカー。1要素につき1箇所まで
- iconは必ず次のリストから選ぶ: ${iconListForPrompt()}
- 文字数を守る(長すぎるとデザインが崩れます)。タイトルは18文字以内、checklist項目は28文字以内
- 誇張・断定しすぎる表現、特定企業への言及、医療・法律・金融の断定的アドバイスは避ける`;
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini APIエラー: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Geminiの応答が空です: ${JSON.stringify(data).slice(0, 500)}`);
  try {
    return JSON.parse(extractFirstJsonObject(text));
  } catch (e) {
    fs.writeFileSync(path.join(OUT_DIR, 'debug-raw-response.txt'), text);
    throw new Error(`JSON解析に失敗しました(output/debug-raw-response.txt に生データを保存): ${e.message}`);
  }
}

// Geminiが末尾に余分な文字(例: 閉じ括弧の重複)を付けることがあるため、
// 最初の "{" から対応する "}" までだけを取り出して末尾のゴミを無視する。
function extractFirstJsonObject(text) {
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

function validate(post) {
  if (!Array.isArray(post.slides) || post.slides.length < 3) throw new Error('slidesが3枚未満です');
  if (post.slides.length > 10) post.slides = post.slides.slice(0, 10); // カルーセル上限
  if (typeof post.caption !== 'string') throw new Error('captionがありません');
  if (!Array.isArray(post.hashtags)) post.hashtags = [];
  return post;
}

async function main() {
  const mock = process.argv.includes('--mock');
  const brand = JSON.parse(fs.readFileSync(path.join(ROOT, `config/brand.${BRAND}.json`), 'utf8'));
  const topic = pickTopic();
  console.log(`ブランド: ${BRAND} / テーマ: ${topic.theme}${mock ? ' (mockモード)' : ''}`);

  let post;
  if (mock) {
    post = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/fixtures/mock-post.json'), 'utf8'));
  } else {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY が設定されていません(テストは --mock を使ってください)');
    post = await callGemini(buildPrompt(topic, brand));
  }
  post = validate(post);
  post.meta = { brand: BRAND, theme: topic.theme, generatedAt: new Date().toISOString(), mock };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'post.json'), JSON.stringify(post, null, 2));
  console.log(`output/post.json を生成しました(スライド${post.slides.length}枚)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
