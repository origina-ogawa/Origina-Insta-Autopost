#!/usr/bin/env node
// producer.md が書く work/<slug>/slides.json (no/heading/body形式) を、
// src/render.js が読める output/post.json (cover/body/summary + blocks形式) に変換する。
//
// render.js 自体は本番の daily-post.yml が依存している実績のあるコードなので変更しない。
// このスクリプトは「間に立って形式を変換するだけ」の追加専用ファイルで、
// 既存のパイプライン(generate.js → render.js)には一切手を入れない。
//
// 使い方:
//   node scripts/slides-to-post.mjs --slug <slug>          … work/<slug>/slides.json を読み、output/post.json に書く
//   node scripts/slides-to-post.mjs --in <path> --out <path> … 入出力パスを明示指定
//
// 変換の割り切り(詳細はPR説明 / 設計メモ参照):
//   - 1枚目 → cover、最後の1枚 → summary、間の枚数 → body。それぞれ1ブロックの
//     シンプルな構成にする(producer.mdのslides.jsonにはlead/checklist/compareのような
//     部品指定が無いため、re-designはできない)
//   - icon は指定しない(src/lib/components.js の safeIcon() が未指定時にフォールバック
//     アイコン(ti-circle)を使う既存の仕組みにそのまま乗る)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** 見出し文字列を、表紙スライド用に短い行へ機械的に分割する(装飾的な改行の作り込みはしない) */
export function wrapHeadingToLines(heading, { maxLineLen = 8, maxLines = 4 } = {}) {
  const chars = Array.from(String(heading ?? ''));
  if (chars.length === 0) return [''];

  const lines = [];
  for (let i = 0; i < chars.length; i += maxLineLen) {
    lines.push(chars.slice(i, i + maxLineLen).join(''));
  }
  if (lines.length <= maxLines) return lines;

  // 行数が上限を超えたら、超過分をまとめて最後の行に押し込む(欠落させない)
  const head = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1).join('');
  head.push(tail);
  return head;
}

function assertValidSlidesJson(slidesJson) {
  if (!slidesJson || typeof slidesJson !== 'object') {
    throw new Error('slides.json の中身がオブジェクトではありません');
  }
  if (typeof slidesJson.caption !== 'string' || !slidesJson.caption) {
    throw new Error('slides.json に caption がありません');
  }
  if (!Array.isArray(slidesJson.slides) || slidesJson.slides.length === 0) {
    throw new Error('slides.json の slides が空です');
  }
  slidesJson.slides.forEach((s, i) => {
    if (typeof s.heading !== 'string' || !s.heading) {
      throw new Error(`slides[${i}] に heading がありません`);
    }
    if (typeof s.body !== 'string' || !s.body) {
      throw new Error(`slides[${i}] に body がありません`);
    }
  });
}

/** producer.mdのslides.json → render.jsのpost.json */
export function convertSlidesToPost(slidesJson) {
  assertValidSlidesJson(slidesJson);
  const slides = slidesJson.slides;
  const lastIndex = slides.length - 1;

  const converted = slides.map((slide, i) => {
    if (i === 0) {
      return {
        type: 'cover',
        title_lines: wrapHeadingToLines(slide.heading),
        marker_line: 0,
      };
    }
    if (i === lastIndex) {
      return {
        type: 'summary',
        title: slide.heading,
        items: [{ text: slide.body }],
      };
    }
    return {
      type: 'body',
      number: String(slide.no ?? i + 1).padStart(2, '0'),
      title: slide.heading,
      blocks: [{ type: 'paragraph', text: slide.body }],
    };
  });

  return {
    header_title: slides[0].heading,
    caption: slidesJson.caption,
    hashtags: slidesJson.hashtags || [],
    slides: converted,
    meta: {
      source: 'producer.slides.json',
      slug: slidesJson.slug || null,
      convertedAt: new Date().toISOString(),
    },
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key?.startsWith('--')) out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let inPath = args.in;
  if (!inPath) {
    if (!args.slug) {
      console.error('使い方: node scripts/slides-to-post.mjs --slug <slug> または --in <slides.jsonのパス>');
      process.exit(1);
    }
    inPath = path.join(ROOT, 'work', args.slug, 'slides.json');
  } else {
    inPath = path.resolve(ROOT, inPath);
  }

  const outPath = path.resolve(ROOT, args.out || 'output/post.json');

  const slidesJson = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const post = convertSlidesToPost(slidesJson);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(post, null, 2), 'utf8');
  console.log(`変換完了: ${path.relative(ROOT, inPath)} → ${path.relative(ROOT, outPath)}(${post.slides.length}枚)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
