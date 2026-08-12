// Instagram公式API(Content Publishing)でカルーセル投稿する。
// 前提: 画像が公開URLで取得できること(publish.yml が posts/<dir> の内容を
//       マージ後のコミットに含め、IMAGE_BASE_URL 環境変数で渡す)。
// 必要な環境変数: IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL
// 入力: posts/<dir>/slides.json (caption, hashtags) と posts/<dir>/slide-*.png
// 出力: posts/<dir>/published.json (投稿成功時のみ)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
// 「Instagramログインによる API設定」(IGAAで始まるトークン)は graph.facebook.com ではなく
// graph.instagram.com を使う。Facebookページ経由の旧方式とはAPIのホストが異なる点に注意。
const API = `https://graph.instagram.com/${process.env.GRAPH_API_VERSION || 'v23.0'}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseDirArg(argv) {
  const idx = argv.indexOf('--dir');
  if (idx === -1 || !argv[idx + 1]) return null;
  return argv[idx + 1];
}

export function buildCaption(post) {
  return [post.caption, '', (post.hashtags || []).join(' ')].join('\n').trim();
}

export function listSlideImages(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^slide-\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
}

export function buildPublishedRecord(mediaId, now = new Date()) {
  return { postedAt: now.toISOString(), mediaId };
}

async function graph(pathname, params) {
  const res = await fetch(`${API}/${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, access_token: process.env.IG_ACCESS_TOKEN }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Graph APIエラー (${pathname}): ${JSON.stringify(data.error || data)}`);
  return data;
}

async function waitUntilReady(containerId, label) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${API}/${containerId}?fields=status_code&access_token=${process.env.IG_ACCESS_TOKEN}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`コンテナ処理失敗 (${label}): ${JSON.stringify(data)}`);
    await sleep(3000);
  }
  throw new Error(`コンテナ処理がタイムアウトしました (${label})`);
}

async function notifyChatwork(message) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;
  if (!token || !roomId) return;
  await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ body: message }),
  }).catch((e) => console.warn('Chatwork通知に失敗:', e.message));
}

async function main() {
  const targetDir = parseDirArg(process.argv.slice(2));
  if (!targetDir) throw new Error('--dir <posts配下のフォルダ名> を指定してください');

  const { IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL } = process.env;
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN が設定されていません');
  if (!IMAGE_BASE_URL) throw new Error('IMAGE_BASE_URL が設定されていません(画像の公開URLのベース)');

  const dir = path.join(POSTS_DIR, targetDir);
  const post = JSON.parse(fs.readFileSync(path.join(dir, 'slides.json'), 'utf8'));
  const images = listSlideImages(dir);
  if (images.length < 2) throw new Error('カルーセルには画像が2枚以上必要です');

  const caption = buildCaption(post);

  const children = [];
  for (const img of images) {
    const url = `${IMAGE_BASE_URL.replace(/\/$/, '')}/${img}`;
    console.log(`子コンテナ作成: ${url}`);
    const { id } = await graph(`${IG_USER_ID}/media`, { image_url: url, is_carousel_item: true });
    await waitUntilReady(id, img);
    children.push(id);
  }

  const parent = await graph(`${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  });
  await waitUntilReady(parent.id, 'carousel');

  const published = await graph(`${IG_USER_ID}/media_publish`, { creation_id: parent.id });
  console.log(`投稿完了! media_id: ${published.id}`);

  fs.writeFileSync(
    path.join(dir, 'published.json'),
    JSON.stringify(buildPublishedRecord(published.id), null, 2)
  );
  console.log(`posts/${targetDir}/published.json を作成しました`);

  await notifyChatwork(
    `[info][title]Instagram自動投稿 完了[/title]フォルダ: ${targetDir}\nスライド: ${images.length}枚\nmedia_id: ${published.id}[/info]`
  );
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(async (e) => {
    console.error(e);
    await notifyChatwork(`[info][title]Instagram自動投稿 失敗[/title]${String(e.message).slice(0, 500)}[/info]`).catch(() => {});
    process.exit(1);
  });
}
