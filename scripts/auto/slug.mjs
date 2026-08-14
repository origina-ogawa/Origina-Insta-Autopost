// posts/<dir>/ のディレクトリ名(YYYY-MM-DD-<slug>)を組み立てるためのユーティリティ。
export function todayJst(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function sanitizeSlug(input, fallback) {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

// AIが有効なslugを返さなかった場合の保険。テーマ文字列から決定的に短い英数字列を作る。
export function fallbackSlugFromTheme(theme) {
  return 'post-' + Buffer.from(String(theme), 'utf8').toString('hex').slice(0, 10);
}
