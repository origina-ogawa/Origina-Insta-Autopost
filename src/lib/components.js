// スライドHTMLの組み立て。デザインの品質はここ(CSS)で固定し、
// 「どの部品をどう組み合わせるか」だけをAI(post.json)に選ばせる。
import { esc, rich, richTitle } from './text.js';
import { safeIcon } from './icons.js';

function baseCss(c) {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1080px;
    font-family: 'Noto Sans JP', sans-serif;
    background: ${c.primary}; color: ${c.primary};
    display: flex; flex-direction: column;
    padding: 22px 36px; overflow: hidden;
  }
  .accent { color: ${c.red}; font-weight: 700; }
  .marker { background: linear-gradient(transparent 62%, ${c.yellow} 62%); font-weight: 900; }

  .header { display: flex; align-items: center; gap: 14px; padding: 6px 4px 16px; }
  .header .warn { width: 44px; height: 44px; border-radius: 10px; background: ${c.yellow};
    display: flex; align-items: center; justify-content: center; font-size: 28px; color: ${c.primary}; }
  .header h1 { color: #fff; font-size: 26px; font-weight: 900; letter-spacing: 1px; }

  .card { background: #fff; border-radius: 14px; flex: 1;
    padding: 26px 34px 22px; display: flex; flex-direction: column; gap: 16px; min-height: 0;
    position: relative; overflow: hidden; }
  .card.has-character .panel { padding-right: 280px; }
  /* キャラクター表示時はパネル横幅が狭くなる分だけ、文字をわずかに小さくする(6枚目=まとめスライドに近いサイズ) */
  /* paraは本文の先頭側(キャラクターの頭より上)にしか出ないため、パネルの右余白を一部取り戻して1行に収まりやすくする */
  .card.has-character .para { font-size: 50px; line-height: 1.42; margin-right: -200px; }
  .card.has-character .lead { margin-bottom: 40px; }
  .card.has-character .lead b { font-size: 44px; }
  .card.has-character .compare { margin-top: 44px; padding: 40px 22px; }
  .card.has-character .compare .item { font-size: 30px; }
  .card.has-character .compare .item i { font-size: 76px; margin-bottom: 10px; }
  .card.has-character .pill { font-size: 32px; margin-bottom: 28px; }
  .card.has-character .check-item { font-size: 40px; padding: 22px 26px; }
  .card.has-character .check-item .cbox { width: 60px; height: 60px; font-size: 32px; }

  .title-row { display: flex; gap: 24px; align-items: center; }
  .no { position: relative; flex-shrink: 0; width: 76px; height: 76px; background: ${c.primary};
    color: #fff; font-size: 40px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .no::after { content: ''; position: absolute; right: -12px; bottom: -12px;
    width: 76px; height: 76px; background: ${c.yellow}; z-index: -1; }
  .title-main { min-width: 0; }
  .title-main h2 { font-size: 44px; font-weight: 900; line-height: 1.3; }
  .title-visual { margin-left: auto; flex-shrink: 0; }
  .big-ic { width: 120px; height: 120px; border: 5px solid ${c.primary}; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 64px; color: ${c.primary};
    position: relative; background: #fff; }
  .big-ic .badge { position: absolute; right: -10px; bottom: -4px; width: 46px; height: 46px;
    border-radius: 50%; background: ${c.primary}; color: #fff; font-size: 26px;
    display: flex; align-items: center; justify-content: center; }

  .body-character { position: absolute; right: 16px; bottom: 0;
    max-width: 330px; max-height: 540px; width: auto; height: auto;
    object-fit: contain; object-position: bottom; z-index: 2; }
  .cover-character { position: absolute; right: -24px; bottom: 0;
    max-width: 420px; max-height: 760px; width: auto; height: auto;
    object-fit: contain; object-position: bottom; }

  .body-grid { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .panel { background: ${c.panel}; border-radius: 18px; padding: 40px 44px;
    flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .panel.light { background: ${c.panelLight}; }

  .lead { display: flex; align-items: center; gap: 22px; margin-bottom: 44px; }
  .lead .ic { width: 92px; height: 92px; border-radius: 50%; background: ${c.primary}; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 50px; flex-shrink: 0; }
  .lead b { font-size: 46px; font-weight: 900; }
  .para { font-size: 54px; line-height: 1.45; font-weight: 700; }

  .compare { margin-top: 56px; background: #fff; border: 2px dashed #b9c2d4; border-radius: 18px;
    padding: 48px 24px; display: flex; align-items: center; justify-content: space-around; gap: 8px; }
  .compare .item { text-align: center; font-size: 32px; font-weight: 700; line-height: 1.35; }
  .compare .item i { font-size: 84px; display: block; margin-bottom: 14px; }
  .compare .ne { font-size: 52px; font-weight: 900; }

  .pill { background: ${c.primary}; color: #fff; border-radius: 999px; font-size: 28px;
    font-weight: 700; text-align: center; padding: 14px 20px; margin-bottom: 36px; }
  .pill .marker { background: none; color: ${c.yellow}; font-weight: 900; }
  .pill .accent { color: ${c.yellow}; }
  .checklist-items { display: flex; flex-direction: column; justify-content: center; gap: 22px; }
  .check-item { display: flex; align-items: center; gap: 22px; font-size: 42px;
    font-weight: 700; line-height: 1.35; background: #fff; border-radius: 14px;
    padding: 24px 28px; box-shadow: 0 2px 8px rgba(22, 41, 77, 0.08); }
  .check-item .cbox { width: 64px; height: 64px; border-radius: 12px; background: ${c.primary};
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 34px; flex-shrink: 0; }

  .summary { background: ${c.cream}; border-radius: 14px; padding: 22px 28px;
    display: flex; align-items: center; gap: 18px; }
  .summary .ok { width: 54px; height: 54px; border-radius: 50%; border: 5px solid ${c.primary};
    display: flex; align-items: center; justify-content: center; font-size: 30px; color: ${c.yellow};
    flex-shrink: 0; background: #fff; }
  .summary p { font-size: 27px; font-weight: 700; line-height: 1.5; }
  .summary .side-ic { margin-left: auto; font-size: 52px; color: ${c.primary}; flex-shrink: 0; }

  .footer { display: flex; align-items: center; gap: 18px; padding: 12px 8px 0; }
  .footer .bulb { width: 52px; height: 52px; border-radius: 50%; border: 3px solid #fff;
    color: ${c.yellow}; display: flex; align-items: center; justify-content: center;
    font-size: 30px; flex-shrink: 0; }
  .footer p { color: #fff; font-size: 20px; font-weight: 700; line-height: 1.5; }
  .footer .marker { background: none; color: ${c.yellow}; }
  .footer .accent { color: ${c.yellow}; }
  .footer .swipe { margin-left: auto; color: #fff; font-family: 'Caveat', cursive; font-size: 38px; }

  .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: flex-start;
    padding: 40px 30px 20px; position: relative; }
  .cover-title { font-size: 96px; font-weight: 900; line-height: 1.3; }
  .cover-body.has-character .cover-title { max-width: 640px; }
  .cover-title .marker-line { background: linear-gradient(transparent 68%, ${c.yellow} 68%); }
  .cover-visual { position: absolute; right: 40px; bottom: 30px; font-size: 200px;
    color: ${c.primary}; opacity: 0.92; display: flex; align-items: flex-end; gap: 4px; }
  .cover-visual .x-badge { width: 90px; height: 90px; border-radius: 50%; background: ${c.primary};
    color: #fff; font-size: 52px; display: flex; align-items: center; justify-content: center; }

  .sum-title { font-size: 60px; font-weight: 900; text-align: center; padding: 10px 0 4px; }
  .sum-list { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 22px;
    background: ${c.panel}; border-radius: 18px; padding: 44px 48px; }

  .brand-body { flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 56px; padding: 20px 40px; text-align: center; position: relative; }
  .brand-body.has-character { padding-right: 320px; }
  .brand-body.has-character .brand-tagline { font-size: 54px; white-space: nowrap; }
  .brand-body.has-character .brand-logo { max-width: 580px; }
  .brand-tagline { font-size: 68px; font-weight: 900; line-height: 1.4; }
  .brand-logo { max-width: 720px; max-height: 400px; object-fit: contain; }
  .brand-character { position: absolute; right: -50px; bottom: 0;
    max-width: 380px; max-height: 720px; width: auto; height: auto;
    object-fit: contain; object-position: bottom; }
  `;
}

function page(brand, bodyHtml) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>${baseCss(brand.colors)}</style></head><body>${bodyHtml}</body></html>`;
}

function header(headerTitle) {
  return `<div class="header"><div class="warn"><i class="ti ti-alert-triangle"></i></div>
    <h1>${richTitle(headerTitle)}</h1></div>`;
}

function footer(brand, { hideSwipe = false } = {}) {
  return `<div class="footer"><div class="bulb"><i class="ti ti-bulb"></i></div>
    <p>${rich(brand.footer.text)}</p>${hideSwipe ? '' : `<div class="swipe">${esc(brand.footer.swipe)}</div>`}</div>`;
}

function renderBlock(block) {
  switch (block.type) {
    case 'lead':
      return `<div class="panel"><div class="lead"><div class="ic"><i class="ti ${safeIcon(block.icon)}"></i></div>
        <b>${rich(block.title || 'それ、**要注意**です!')}</b></div>
        <p class="para">${rich(block.text)}</p>${block.compare ? compareHtml(block.compare) : ''}</div>`;
    case 'paragraph':
      return `<div class="panel"><p class="para">${rich(block.text)}</p></div>`;
    case 'compare':
      return `<div class="panel">${compareHtml(block)}</div>`;
    case 'checklist':
      return `<div class="panel light">${block.header ? `<div class="pill">${rich(block.header)}</div>` : ''}
        <div class="checklist-items">${(block.items || []).map((it) => `<div class="check-item"><div class="cbox"><i class="ti ${safeIcon(it.icon)}"></i></div><div>${rich(it.text)}</div></div>`).join('')}</div></div>`;
    default:
      return `<div class="panel"><p class="para">${rich(block.text || '')}</p></div>`;
  }
}

function compareHtml(cmp) {
  const side = (s) => `<div class="item"><i class="ti ${safeIcon(s.icon)}"></i>${rich(s.label)}</div>`;
  return `<div class="compare">${side(cmp.left)}<div class="ne">&ne;</div>${side(cmp.right)}</div>`;
}

// 表紙のtitle_linesは行単位のmarker_lineだけで装飾する仕様だが、
// AIが本文と同じ **強調** / ==マーカー== 記法を混ぜてくることがあるため無害化する。
const stripInlineMarkup = (s) => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1');

/** 表紙スライド */
export function coverSlide(brand, headerTitle, slide, characterUri) {
  const lines = (slide.title_lines || []).map((line, i) =>
    i === (slide.marker_line ?? 0)
      ? `<span class="marker-line">${esc(stripInlineMarkup(line))}</span>`
      : esc(stripInlineMarkup(line))
  ).join('<br>');
  const visual = characterUri
    ? `<img class="cover-character" src="${characterUri}" alt="">`
    : `<div class="cover-visual"><i class="ti ${safeIcon(slide.icon)}"></i>
        <div class="x-badge"><i class="ti ti-x"></i></div></div>`;
  const body = `
    ${header(headerTitle)}
    <div class="card"><div class="cover-body${characterUri ? ' has-character' : ''}">
      <div class="cover-title">${lines}</div>
      ${visual}
    </div></div>
    ${footer(brand)}`;
  return page(brand, body);
}

/** 本文スライド(番号 + タイトル + 1要素のブロック + キャラクター) */
export function bodySlide(brand, headerTitle, slide, characterUri) {
  const blocks = (slide.blocks || []).map(renderBlock);
  const grid = `<div class="body-grid"><div class="col">${blocks.join('')}</div></div>`;
  const topicIcon = `<div class="title-visual"><div class="big-ic"><i class="ti ${safeIcon(slide.icon)}"></i>
    <div class="badge"><i class="ti ti-question-mark"></i></div></div></div>`;
  const character = characterUri ? `<img class="body-character" src="${characterUri}" alt="">` : '';
  const body = `
    ${header(headerTitle)}
    <div class="card${characterUri ? ' has-character' : ''}">
      <div class="title-row">
        <div class="no">${esc(slide.number || '')}</div>
        <div class="title-main"><h2>${richTitle(slide.title)}</h2></div>
        ${characterUri ? '' : topicIcon}
      </div>
      ${grid}
      ${character}
    </div>
    ${footer(brand)}`;
  return page(brand, body);
}

/** まとめスライド */
export function summarySlide(brand, headerTitle, slide) {
  const body = `
    ${header(headerTitle)}
    <div class="card">
      <div class="sum-title">${richTitle(slide.title || 'まとめ')}</div>
      <div class="sum-list">
        ${(slide.items || []).map((it) => `<div class="check-item"><div class="cbox"><i class="ti ${safeIcon(it.icon)}"></i></div><div>${rich(it.text)}</div></div>`).join('')}
      </div>
      ${slide.cta ? `<div class="summary"><div class="ok"><i class="ti ti-check"></i></div>
        <p>${rich(slide.cta)}</p><i class="ti ti-sparkles side-ic"></i></div>` : ''}
    </div>
    ${footer(brand)}`;
  return page(brand, body);
}

/** 固定のブランディングスライド(カルーセル最後尾に毎回付与)。AI生成ではなく設定ファイルから組み立てる */
export function brandSlide(brand, headerTitle, logoDataUri, characterUri) {
  const tagline = brand.brandSlide?.tagline || '';
  const character = characterUri ? `<img class="brand-character" src="${characterUri}" alt="">` : '';
  const body = `
    ${header(headerTitle)}
    <div class="card"><div class="brand-body${characterUri ? ' has-character' : ''}">
      <div class="brand-tagline">${richTitle(tagline)}</div>
      <img class="brand-logo" src="${logoDataUri}" alt="ロゴ">
      ${character}
    </div></div>
    ${footer(brand, { hideSwipe: true })}`;
  return page(brand, body);
}

/** post.json のスライド1枚をHTML文字列に変換する */
export function renderSlide(brand, headerTitle, slide, characterUri) {
  if (slide.type === 'cover') return coverSlide(brand, headerTitle, slide, characterUri);
  if (slide.type === 'summary') return summarySlide(brand, headerTitle, slide);
  return bodySlide(brand, headerTitle, slide, characterUri);
}
