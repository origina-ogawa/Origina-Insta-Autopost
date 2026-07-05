// AI生成テキストの安全な埋め込み。
// 1. HTMLエスケープ(タグ注入を防ぐ)
// 2. 記法変換: **強調** → 赤字 / ==マーカー== → 黄色マーカー / \n → <br>

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function rich(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<span class="accent">$1</span>')
    .replace(/==(.+?)==/g, '<span class="marker">$1</span>')
    .replaceAll('\n', '<br>');
}

/** マーカー(黄)だけ有効にしたいタイトル用 */
export function richTitle(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<span class="marker">$1</span>')
    .replace(/==(.+?)==/g, '<span class="marker">$1</span>')
    .replaceAll('\n', '<br>');
}
