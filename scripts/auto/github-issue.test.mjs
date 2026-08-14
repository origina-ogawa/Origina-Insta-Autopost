import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIssue, commentIssue, closeIssue } from './github-issue.mjs';

function fakeExecFile(returnValue) {
  const calls = [];
  const fn = (cmd, args) => {
    calls.push({ cmd, args });
    return returnValue;
  };
  fn.calls = calls;
  return fn;
}

test('createIssueはgh issue createを呼び、URLからIssue番号を取り出す', () => {
  const execFile = fakeExecFile('https://github.com/owner/repo/issues/42\n');
  const number = createIssue({ title: 'タイトル', body: '本文' }, execFile);
  assert.equal(number, 42);
  assert.equal(execFile.calls[0].cmd, 'gh');
  assert.deepEqual(execFile.calls[0].args, ['issue', 'create', '--title', 'タイトル', '--body', '本文']);
});

test('createIssueはURLにissues番号が無いとエラーを投げる', () => {
  const execFile = fakeExecFile('想定外の出力');
  assert.throws(() => createIssue({ title: 't', body: 'b' }, execFile), /Issue番号を取得できません/);
});

test('commentIssueはgh issue commentを正しい引数で呼ぶ', () => {
  const execFile = fakeExecFile('');
  commentIssue(42, 'コメント本文', execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'comment', '42', '--body', 'コメント本文']);
});

test('closeIssueはbody指定時に--commentを付ける', () => {
  const execFile = fakeExecFile('');
  closeIssue(42, 'クローズ理由', execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'close', '42', '--comment', 'クローズ理由']);
});

test('closeIssueはbody省略時に--commentを付けない', () => {
  const execFile = fakeExecFile('');
  closeIssue(42, undefined, execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'close', '42']);
});
