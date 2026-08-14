// slides.json(producer.md互換スキーマ)を、tokens.jsonの文字数上限などに照らして機械的に検証する。
// 文字数はAIに数えさせるより確実なため、コードで判定する
// (rubric/carousel.mdの「2. 文字量」「3-1 枚数」に対応。定性項目はgemini-judge.mjsが担当する)。
//
// caption/heading/bodyの非空チェックは、scripts/slides-to-post.mjsのassertValidSlidesJson()が
// 空だとエラーで停止するため、そこに到達する前に(＝自己検収の差し戻し対象として)ここで検出する。
//
// スライド枚数の実質上限を9枚にしているのは、src/render.jsが末尾に固定のブランドスライドを
// 必ず1枚追加するため(src/generate.jsのvalidate()と同じ理由)。tokens.jsonのslideCountMax(10)を
// そのまま上限にすると、9+1=10ではなく10+1=11枚になり、InstagramカルーセルAPIの上限(10枚)を超える。
const CONTENT_SLIDE_MAX = 9;

export function mechanicalCheck(slidesJson, tokens) {
  const violations = [];
  const slides = slidesJson.slides || [];

  if (typeof slidesJson.caption !== 'string' || !slidesJson.caption.trim()) {
    violations.push('captionが空です');
  }

  const effectiveMax = Math.min(tokens.limits.slideCountMax, CONTENT_SLIDE_MAX);
  if (slides.length < tokens.limits.slideCountMin || slides.length > effectiveMax) {
    violations.push(
      `スライド枚数が${slides.length}枚です(${tokens.limits.slideCountMin}〜${effectiveMax}枚が必要。` +
        `末尾に固定のブランドスライドが1枚追加されるため、Instagramカルーセル上限10枚に収まるよう` +
        `${CONTENT_SLIDE_MAX}枚までに制限している)`
    );
  }

  if (!Array.isArray(slidesJson.hashtags) || slidesJson.hashtags.length > 3) {
    violations.push(`hashtagsが${slidesJson.hashtags?.length ?? 0}個です(3個以内が必要)`);
  }

  slides.forEach((s, i) => {
    const heading = s.heading || '';
    const body = s.body || '';
    const n = i + 1;
    if (!heading.trim()) {
      violations.push(`${n}枚目の見出しが空です`);
    }
    if (!body.trim()) {
      violations.push(`${n}枚目の本文が空です`);
    }
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
