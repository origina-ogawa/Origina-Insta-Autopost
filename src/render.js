// output/post.json を読み、スライドごとにHTMLを組み立てて
// Playwright(Chromium)で1080x1080のPNGにする。
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { renderSlide, brandSlide } from './lib/components.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const BRAND = process.env.BRAND || 'own';

async function main() {
  const post = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'post.json'), 'utf8'));
  const brand = JSON.parse(fs.readFileSync(path.join(ROOT, `config/brand.${BRAND}.json`), 'utf8'));
  const headerTitle = post.header_title || post.slides.find((s) => s.type === 'cover')?.title_lines?.join('') || 'お役立ち情報';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });

  const htmlSlides = post.slides.map((slide) => renderSlide(brand, headerTitle, slide));
  if (brand.brandSlide?.enabled) {
    htmlSlides.push(brandSlide(brand, headerTitle, loadLogoDataUri(brand.brandSlide.logo)));
  }

  for (let i = 0; i < htmlSlides.length; i++) {
    const html = htmlSlides[i];
    fs.writeFileSync(path.join(OUT_DIR, `slide-${i + 1}.html`), html); // デバッグ用に残す
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready); // Webフォント読み込み完了を待つ
    const file = path.join(OUT_DIR, `slide-${i + 1}.png`);
    await page.screenshot({ path: file });
    console.log(`生成: output/slide-${i + 1}.png`);
  }
  await browser.close();
  console.log(`完了: ${htmlSlides.length}枚のスライドを生成しました`);
}

function loadLogoDataUri(relativePath) {
  const logoPath = path.join(ROOT, relativePath);
  const ext = path.extname(logoPath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext || 'png';
  const base64 = fs.readFileSync(logoPath).toString('base64');
  return `data:image/${mime};base64,${base64}`;
}

main().catch((e) => { console.error(e); process.exit(1); });
