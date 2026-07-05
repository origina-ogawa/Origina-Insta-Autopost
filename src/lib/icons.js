// Tabler Icons のホワイトリスト。AIはこの中からアイコン名を選ぶ。
// 存在しない名前を出力した場合は FALLBACK_ICON に差し替える。
export const ICON_WHITELIST = new Set([
  // 警告・注意
  'ti-alert-triangle', 'ti-alert-circle', 'ti-question-mark', 'ti-x', 'ti-ban',
  // チェック・OK
  'ti-check', 'ti-checks', 'ti-circle-check', 'ti-thumb-up',
  // お金・契約
  'ti-coin', 'ti-coins', 'ti-file-dollar', 'ti-receipt', 'ti-calculator', 'ti-pig-money',
  // Web・デバイス
  'ti-world', 'ti-device-desktop', 'ti-device-mobile', 'ti-devices', 'ti-browser',
  'ti-layout', 'ti-template', 'ti-code', 'ti-seo',
  // メール・連絡
  'ti-mail', 'ti-mail-x', 'ti-message-circle', 'ti-phone', 'ti-send',
  // 人・組織
  'ti-user', 'ti-users', 'ti-user-off', 'ti-building', 'ti-briefcase',
  // 分析・成果
  'ti-chart-bar', 'ti-chart-bar-off', 'ti-chart-line', 'ti-trending-up', 'ti-trending-down',
  'ti-target-arrow', 'ti-zoom-check', 'ti-search',
  // セキュリティ・権利
  'ti-lock', 'ti-lock-open', 'ti-shield-check', 'ti-shield-x', 'ti-key',
  // 時間・更新
  'ti-clock', 'ti-calendar', 'ti-refresh', 'ti-history',
  // 書類・情報
  'ti-file-text', 'ti-file-search', 'ti-file-check', 'ti-clipboard-list', 'ti-list-check',
  'ti-notes', 'ti-book',
  // アイデア・その他
  'ti-bulb', 'ti-star', 'ti-sparkles', 'ti-rocket', 'ti-tool', 'ti-settings',
  'ti-heart', 'ti-eye', 'ti-link', 'ti-photo', 'ti-robot', 'ti-brain',
]);

export const FALLBACK_ICON = 'ti-point';

/** AIが出したアイコン名を検証し、不正ならフォールバックに置き換える */
export function safeIcon(name) {
  if (typeof name !== 'string') return FALLBACK_ICON;
  const n = name.trim();
  return ICON_WHITELIST.has(n) ? n : FALLBACK_ICON;
}

/** プロンプトに埋め込む用のアイコン一覧文字列 */
export function iconListForPrompt() {
  return [...ICON_WHITELIST].join(', ');
}
