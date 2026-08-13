// カルーセル内のスライドに、使い回すキャラクター画像(ポーズ)を順番に割り当てる。
// まとめスライド(summary)にはキャラクターを付けない。
export function assignCharacterPoses(slides, poseUris) {
  if (!poseUris || poseUris.length === 0) return slides.map(() => undefined);
  let i = 0;
  return slides.map((slide) => {
    if (slide.type === 'summary') return undefined;
    const uri = poseUris[i % poseUris.length];
    i += 1;
    return uri;
  });
}
