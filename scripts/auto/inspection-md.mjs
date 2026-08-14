// posts/<dir>/inspection.md を組み立てる。scripts/detect-pending.mjsのPASS_PATTERNが
// 一致する固定フォーマットの先頭行を必ず含める(一致しないとpublish.ymlが検出できない)。
export function buildInspectionMd(attempt) {
  return `# 検収結果: 合格(第${attempt}回・自動検収)

GitHub Actionsの自動投稿パイプライン(機械チェック + Gemini判定)に合格しました。
判定の根拠は自動投稿Issueのコメント履歴を参照してください。
`;
}
