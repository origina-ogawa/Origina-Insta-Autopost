import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCopywriteInspectLoop } from './inspect-loop.mjs';

function baseArgs() {
  return [{ theme: 'テスト' }, [{ role: 'hook', point: 'x', sourceIndex: 1 }], [{ url: 'https://a.example.com' }], {}, 'rubric'];
}

test('1回目で機械チェック・Gemini判定とも合格なら1回で終わる', async () => {
  let writeSlidesCalls = 0;
  const deps = {
    writeSlides: async () => {
      writeSlidesCalls++;
      return { slides: [] };
    },
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => ({ ok: true, reasons: [] }),
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, true);
  assert.equal(result.attempts, 1);
  assert.equal(writeSlidesCalls, 1);
});

test('機械チェックがNGならGemini判定を呼ばずに差し戻す', async () => {
  let judgeCalls = 0;
  const deps = {
    writeSlides: async () => ({ slides: [] }),
    mechanicalCheck: () => ({ ok: false, violations: ['4枚目が72字'] }),
    judgeContent: async () => {
      judgeCalls++;
      return { ok: true, reasons: [] };
    },
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), { ...deps, maxAttempts: 1 });
  assert.equal(result.passed, false);
  assert.equal(judgeCalls, 0);
  assert.deepEqual(result.rejectionReasons, ['4枚目が72字']);
});

test('2回目で合格すればattempts=2で終わる', async () => {
  let call = 0;
  const deps = {
    writeSlides: async () => {
      call++;
      return { slides: [], attempt: call };
    },
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => (call === 1 ? { ok: false, reasons: ['トーンが不適切'] } : { ok: true, reasons: [] }),
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, true);
  assert.equal(result.attempts, 2);
});

test('maxAttempts回とも不合格ならpassed=falseで理由を返す', async () => {
  const deps = {
    writeSlides: async () => ({ slides: [] }),
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => ({ ok: false, reasons: ['情報鮮度が14日を超えている'] }),
    maxAttempts: 3,
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, false);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.rejectionReasons, ['情報鮮度が14日を超えている']);
});

test('2回目の呼び出しには1回目の差し戻し理由が渡される', async () => {
  const receivedReasons = [];
  let call = 0;
  const deps = {
    writeSlides: async (topic, structure, sources, tokens, reasons) => {
      call++;
      receivedReasons.push(reasons);
      return { slides: [] };
    },
    mechanicalCheck: () => ({ ok: false, violations: ['1回目の理由'] }),
    judgeContent: async () => ({ ok: true, reasons: [] }),
    maxAttempts: 2,
  };
  await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.deepEqual(receivedReasons[0], []);
  assert.deepEqual(receivedReasons[1], ['1回目の理由']);
});
