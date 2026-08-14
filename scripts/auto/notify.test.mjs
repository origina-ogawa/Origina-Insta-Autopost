import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyChatwork } from './notify.mjs';

test('notifyChatworkはtoken/roomIdが無ければ何もしない', async () => {
  let called = false;
  await notifyChatwork('メッセージ', { token: undefined, roomId: undefined, fetchImpl: async () => (called = true) });
  assert.equal(called, false);
});

test('notifyChatworkは正しいURLとヘッダーでPOSTする', async () => {
  let capturedUrl, capturedOpts;
  const fetchImpl = async (url, opts) => {
    capturedUrl = url;
    capturedOpts = opts;
    return { ok: true };
  };
  await notifyChatwork('メッセージ', { token: 'tok', roomId: '123', fetchImpl });
  assert.equal(capturedUrl, 'https://api.chatwork.com/v2/rooms/123/messages');
  assert.equal(capturedOpts.headers['X-ChatWorkToken'], 'tok');
  assert.equal(capturedOpts.method, 'POST');
});

test('notifyChatworkはfetch失敗時も例外を投げない', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  await assert.doesNotReject(() => notifyChatwork('メッセージ', { token: 'tok', roomId: '123', fetchImpl }));
});
