// assets/character/pose-*.png の白背景(#FFFFFF)を透過に変換する。自動投稿フローには含まれない、
// キャラクター画像を差し替えた/追加したときに手動で一度だけ実行するスクリプト。
// 背景はほぼ純白・低彩度で、人物部分とは輝度がはっきり分かれているため、
// 「低彩度 かつ 明るい」画素だけを透過にする閾値処理で十分きれいに抜ける。
// 使い方:
//   node scripts/remove-character-background.mjs          … pose-*.png すべて処理
//   node scripts/remove-character-background.mjs pose-05.png … 指定ファイルだけ処理(差し替え後の1枚だけ等)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'assets/character');

const WHITE_LO = 235; // これ以下の輝度は人物として完全不透明のまま
const WHITE_HI = 250; // これ以上の輝度(かつ低彩度)は完全透明
const SAT_MAX = 18; // 彩度がこれを超える画素(服の色など)は透過処理の対象外

async function processFile(filePath) {
  const img = sharp(filePath);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat > SAT_MAX) continue;
    let alpha;
    if (lum >= WHITE_HI) alpha = 0;
    else if (lum <= WHITE_LO) continue;
    else alpha = Math.round(255 * (WHITE_HI - lum) / (WHITE_HI - WHITE_LO));
    data[i + 3] = Math.min(data[i + 3], alpha);
  }
  const tmpPath = `${filePath}.tmp`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmpPath);
  fs.renameSync(tmpPath, filePath);
}

async function main() {
  const targets = process.argv.slice(2);
  const files = targets.length > 0
    ? targets
    : fs.readdirSync(DIR).filter((f) => /^pose-\d+\.png$/.test(f));
  if (files.length === 0) throw new Error(`${path.relative(ROOT, DIR)} に pose-*.png が見つかりません`);
  for (const f of files) {
    await processFile(path.join(DIR, f));
    console.log(`透過処理: ${f}`);
  }
  console.log(`完了: ${files.length}枚を処理しました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
