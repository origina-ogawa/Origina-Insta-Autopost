// slides.json(producer.md互換スキーマ)を、tokens.jsonの文字数上限などに照らして機械的に検証する。
// 文字数はAIに数えさせるより確実なため、コードで判定する
// (rubric/carousel.mdの「2. 文字量」「3-1 枚数」に対応。定性項目はgemini-judge.mjsが担当する)。
export function mechanicalCheck(slidesJson, tokens) {
  const violations = [];
  const slides = slidesJson.slides || [];

  if (slides.length < tokens.limits.slideCountMin || slides.length > tokens.limits.slideCountMax) {
    violations.push(
      `スライド枚数が${slides.length}枚です(${tokens.limits.slideCountMin}〜${tokens.limits.slideCountMax}枚が必要)`
    );
  }

  if (!Array.isArray(slidesJson.hashtags) || slidesJson.hashtags.length > 3) {
    violations.push(`hashtagsが${slidesJson.hashtags?.length ?? 0}個です(3個以内が必要)`);
  }

  slides.forEach((s, i) => {
    const heading = s.heading || '';
    const body = s.body || '';
    const n = i + 1;
    if (heading.length > tokens.font.heading.maxChars) {
      violations.push(`${n}枚目の見出しが${heading.length}字です(${tokens.font.heading.maxChars}字以内)`);
    }
    if (body.length > tokens.font.body.maxChars) {
      violations.push(`${n}枚目の本文が${body.length}字です(${tokens.font.body.maxChars}字以内)`);
    }
    if (heading.length + body.length > tokens.limits.slideTotalChars) {
      violations.push(
        `${n}枚目の合計文字数が${heading.length + body.length}字です(${tokens.limits.slideTotalChars}字以内)`
      );
    }
    if (!s.source_ref) {
      violations.push(`${n}枚目に source_ref がありません`);
    }
  });

  return { ok: violations.length === 0, violations };
}
