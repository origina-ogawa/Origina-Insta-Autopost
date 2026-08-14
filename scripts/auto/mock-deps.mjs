// --mockフラグ用のフェイク依存。Gemini API・gh・Chatworkを一切呼ばず、
// 固定データで正常系(1回で合格)を通す。ローカルでの動作確認・CI用。
function mockSources() {
  return [
    { url: 'https://example.com/a', title: '一次ソースA(モック)' },
    { url: 'https://example.com/b', title: '一次ソースB(モック)' },
    { url: 'https://example.com/c', title: '一次ソースC(モック)' },
  ];
}

function mockSlides() {
  return Array.from({ length: 8 }, (_, i) => ({
    no: i + 1,
    heading: `見出し${i + 1}`,
    body: `本文${i + 1}です`,
    source_ref: 'https://example.com/a',
  }));
}

export const mockDeps = {
  async callGeminiGrounded() {
    return { text: 'モック要約', sources: mockSources() };
  },
  async callGeminiJsonForStructure() {
    return {
      slides: Array.from({ length: 8 }, (_, i) => ({ role: i === 0 ? 'hook' : 'body', point: `要点${i + 1}`, sourceIndex: 1 })),
    };
  },
  async callGeminiJsonForCopy() {
    return {
      slug: 'mock-post',
      caption: 'モックのキャプションです。',
      hashtags: ['#AI', '#DX'],
      sources: mockSources().map((s) => s.url),
      slides: mockSlides(),
    };
  },
  async callGeminiJsonForJudge() {
    return { ok: true, reasons: [] };
  },
  createIssue() {
    return 0;
  },
  commentIssue() {},
  closeIssue() {},
};
