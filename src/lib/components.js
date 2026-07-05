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

  .header { display: flex; align-items: center; gap: 16px; padding: 8px 4px 20px; }
  .header .warn { width: 52px; height: 52px; border-radius: 10px; background: ${c.yellow};
    display: flex; align-items: center; justify-content: center; font-size: 34px; color: ${c.primary}; }
  .header h1 { color: #fff; font-size: 32px; font-weight: 900; letter-spacing: 1px; }

  .card { background: #fff; border-radius: 14px; flex: 1;
    padding: 30px 38px 24px; display: flex; flex-direction: column; gap: 20px; min-height: 0; }

  .title-row { display: flex; gap: 30px; align-items: flex-start; }
  .no { position: relative; flex-shrink: 0; width: 84px; height: 84px; background: ${c.primary};
    color: #fff; font-size: 46px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .no::after { content: ''; position: absolute; right: -14px; bottom: -14px;
    width: 84px; height: 84px; background: ${c.yellow}; z-index: -1; }
  .title-main { min-width: 0; }
  .title-main h2 { font-size: 48px; font-weight: 900; line-height: 1.35; }
  .title-sub { font-size: 23px; font-weight: 500; margin-top: 10px; color: #33415c; line-height: 1.6; }
  .title-visual { margin-left: auto; flex-shrink: 0; }
  .big-ic { width: 150px; height: 150px; border: 5px solid ${c.primary}; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 80px; color: ${c.primary};
    position: relative; background: #fff; }
  .big-ic .badge { position: absolute; right: -12px; bottom: -6px; width: 56px; height: 56px;
    border-radius: 50%; background: ${c.primary}; color: #fff; font-size: 32px;
    display: flex; align-items: center; justify-content: center; }

  .body-grid { display: flex; gap: 26px; flex: 1; min-height: 0; }
  .col { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 20px; min-width: 0; }
  .panel { background: ${c.panel}; border-radius: 14px; padding: 24px 28px; }
  .panel.light { background: ${c.panelLight}; }

  .lead { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .lead .ic { width: 54px; height: 54px; border-radius: 50%; background: ${c.primary}; color: #fff;
    display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; }
  .lead b { font-size: 30px; font-weight: 900; }
  .para { font-size: 22px; line-height: 1.75; font-weight: 500; }

  .compare { margin-top: 16px; background: #fff; border: 2px dashed #b9c2d4; border-radius: 12px;
    padding: 16px 18px; display: flex; align-items: center; justify-content: space-around; gap: 8px; }
  .compare .item { text-align: center; font-size: 20px; font-weight: 700; line-height: 1.4; }
  .compare .item i { font-size: 44px; display: block; margin-bottom: 6px; }
  .compare .ne { font-size: 40px; font-weight: 900; }

  .pill { background: ${c.primary}; color: #fff; border-radius: 999px; font-size: 20px;
    font-weight: 700; text-align: center; padding: 10px 14px; margin-bottom: 16px; }
  .pill .marker { background: none; color: ${c.yellow}; font-weight: 900; }
  .pill .accent { color: ${c.yellow}; }
  .check-item { display: flex; align-items: flex-start; gap: 14px; font-size: 20px;
    font-weight: 700; line-height: 1.5; margin-bottom: 14px; }
  .check-item:last-child { margin-bottom: 0; }
  .check-item .cbox { width: 40px; height: 40px; border-radius: 8px; background: ${c.primary};
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }

  .summary { background: ${c.cream}; border-radius: 14px; padding: 18px 28px;
    display: flex; align-items: center; gap: 22px; }
  .summary .ok { width: 60px; height: 60px; border-radius: 50%; border: 5px solid ${c.primary};
    display: flex; align-items: center; justify-content: center; font-size: 36px; color: ${c.yellow};
    flex-shrink: 0; background: #fff; }
  .summary p { font-size: 23px; font-weight: 700; line-height: 1.6; }
  .summary .side-ic { margin-left: auto; font-size: 60px; color: ${c.primary}; flex-shrink: 0; }

  .footer { display: flex; align-items: center; gap: 22px; padding: 16px 8px 0; }
  .footer .bulb { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff;
    color: ${c.yellow}; display: flex; align-items: center; justify-content: center;
    font-size: 36px; flex-shrink: 0; }
  .footer p { color: #fff; font-size: 23px; font-weight: 700; line-height: 1.6; }
  .footer .marker { background: none; color: ${c.yellow}; }
  .footer .accent { color: ${c.yellow}; }
  .footer .swipe { margin-left: auto; color: #fff; font-family: 'Caveat', cursive; font-size: 44px; }

  .cover-body { flex: 1; display: flex; flex-direction: column; justify-content: center;
    padding: 20px 30px; position: relative; }
  .cover-title { font-size: 96px; font-weight: 900; line-height: 1.3; }
  .cover-title .marker-line { background: linear-gradient(transparent 68%, ${c.yellow} 68%); }
  .cover-visual { position: absolute; right: 40px; bottom: 30px; font-size: 200px;
    color: ${c.primary}; opacity: 0.92; display: flex; align-items: flex-end; gap: 4px; }
  .cover-visual .x-badge { width: 90px; height: 90px; border-radius: 50%; background: ${c.primary};
    color: #fff; font-size: 52px; display: flex; align-items: center; justify-content: center; }

  .sum-title { font-size: 56px; font-weight: 900; text-align: center; padding: 10px 0 4px; }
  .sum-list { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px;
    background: ${c.panel}; border-radius: 14px; padding: 28px 40px; }
  .sum-list .check-item { font-size: 25px; margin-bottom: 10px; }
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

function footer(brand) {
  return `<div class="footer"><div class="bulb"><i class="ti ti-bulb"></i></div>
    <p>${rich(brand.footer.text)}</p><div class="swipe">${esc(brand.footer.swipe)}</div></div>`;
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
        ${(block.items || []).map((it) => `<div class="check-item"><div class="cbox"><i class="ti ${safeIcon(it.icon)}"></i></div><div>${rich(it.text)}</div></div>`).join('')}</div>`;
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
export function coverSlide(brand, headerTitle, slide) {
  const lines = (slide.title_lines || []).map((line, i) =>
    i === (slide.marker_line ?? 0)
      ? `<span class="marker-line">${esc(stripInlineMarkup(line))}</span>`
      : esc(stripInlineMarkup(line))
  ).join('<br>');
  const body = `
    ${header(headerTitle)}
    <div class="card"><div class="cover-body">
      <div class="cover-title">${lines}</div>
      <div class="cover-visual"><i class="ti ${safeIcon(slide.icon)}"></i>
        <div class="x-badge"><i class="ti ti-x"></i></div></div>
    </div></div>
    ${footer(brand)}`;
  return page(brand, body);
}

/** 本文スライド(番号 + タイトル + 部品を左右2カラムに自動配置 + まとめ帯) */
export function bodySlide(brand, headerTitle, slide) {
  const blocks = (slide.blocks || []).map(renderBlock);
  const left = blocks.filter((_, i) => i % 2 === 0).join('');
  const right = blocks.filter((_, i) => i % 2 === 1).join('');
  const grid = blocks.length >= 2
    ? `<div class="body-grid"><div class="col">${left}</div><div class="col">${right}</div></div>`
    : `<div class="body-grid"><div class="col">${blocks.join('')}</div></div>`;
  const body = `
    ${header(headerTitle)}
    <div class="card">
      <div class="title-row">
        <div class="no">${esc(slide.number || '')}</div>
        <div class="title-main"><h2>${richTitle(slide.title)}</h2>
          ${slide.sub ? `<div class="title-sub">${rich(slide.sub)}</div>` : ''}</div>
        <div class="title-visual"><div class="big-ic"><i class="ti ${safeIcon(slide.icon)}"></i>
          <div class="badge"><i class="ti ti-question-mark"></i></div></div></div>
      </div>
      ${grid}
      ${slide.note ? `<div class="summary"><div class="ok"><i class="ti ti-check"></i></div>
        <p>${rich(slide.note)}</p><i class="ti ${safeIcon(slide.note_icon)} side-ic"></i></div>` : ''}
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

/** post.json のスライド1枚をHTML文字列に変換する */
export function renderSlide(brand, headerTitle, slide) {
  if (slide.type === 'cover') return coverSlide(brand, headerTitle, slide);
  if (slide.type === 'summary') return summarySlide(brand, headerTitle, slide);
  return bodySlide(brand, headerTitle, slide);
}
