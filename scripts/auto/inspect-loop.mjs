// 文言清書(producer相当)→自己検収(inspector相当)のreject-retryループ。
// inspector.mdの「3回目の不合格でPMに報告する」ルールと同じ回数(既定3回)まで、
// 差し戻し理由をプロンプトに積み増しながら再生成する。
// 構成案(structure)は差し戻しの対象外(director.mdのルールと同じく、やり直すのは文言清書のみ)。
export async function runCopywriteInspectLoop(
  topic,
  structure,
  sources,
  tokens,
  rubricMarkdown,
  { writeSlides, mechanicalCheck, judgeContent, maxAttempts = 3 }
) {
  let slidesJson;
  let rejectionReasons = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    slidesJson = await writeSlides(topic, structure, sources, tokens, rejectionReasons);
    const mech = mechanicalCheck(slidesJson, tokens);
    const judge = mech.ok ? await judgeContent(slidesJson, sources, rubricMarkdown) : { ok: false, reasons: [] };

    if (mech.ok && judge.ok) {
      return { passed: true, slidesJson, attempts: attempt, rejectionReasons: [] };
    }
    rejectionReasons = [...mech.violations, ...(judge.reasons || [])];
  }

  return { passed: false, slidesJson, attempts: maxAttempts, rejectionReasons };
}
