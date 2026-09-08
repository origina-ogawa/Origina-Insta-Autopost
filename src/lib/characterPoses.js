// カルーセル内のスライドに、使い回すキャラクター画像(ポーズ)を順番に割り当てる。
// まとめスライド(summary)にはキャラクターを付けない。
//
// startIndexは「今回の投稿で何番目のポーズから使い始めるか」。省略時は0番目(常に同じ)になるため、
// 投稿ごとに表紙(=最初に割り当てられるスライド)の見た目を変えたい場合は、
// render.js側でposts/配下の投稿数などから算出した値を渡す。
export function assignCharacterPoses(slides, poseUris, { startIndex = 0 } = {}) {
  if (!poseUris || poseUris.length === 0) return slides.map(() => undefined);
  let i = startIndex;
  return slides.map((slide) => {
    if (slide.type === 'summary') return undefined;
    const uri = poseUris[i % poseUris.length];
    i += 1;
    return uri;
  });
}

// 表紙(=1枚目に割り当てられるポーズ)を投稿ごとに変えるための開始インデックス。
// 「これまでに投稿した件数」を元に決めることで、新しい投稿1件ごとに表紙のポーズが1つずつ進み、
// ポーズ数を一周したら最初に戻る(状態を別ファイルで持たずに済む)。
export function nextCoverStartIndex(existingPostCount, poseCount) {
  if (!poseCount) return 0;
  return existingPostCount % poseCount;
}
