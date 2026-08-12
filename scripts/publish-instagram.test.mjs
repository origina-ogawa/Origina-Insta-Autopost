import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCaption, listSlideImages, buildPublishedRecord, parseDirArg } from './publish-instagram.mjs';

test('buildCaptionはcaptionとhashtagsを改行区切りで結合する', () => {
  const caption = buildCaption({ caption: '本文です', hashtags: ['#AI', '#DX'] });
  assert.equal(caption, '本文です\n\n#AI #DX');
});

test('buildCaptionはhashtagsが無くてもエラーにならない', () => {
  const caption = buildCaption({ caption: '本文です' });
  assert.equal(caption, '本文です');
});

test('listSlideImagesはslide-N.pngだけを番号順で返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slides-test-'));
  fs.writeFileSync(path.join(dir, 'slide-2.png'), '');
  fs.writeFileSync(path.join(dir, 'slide-10.png'), '');
  fs.writeFileSync(path.join(dir, 'slide-1.png'), '');
  fs.writeFileSync(path.join(dir, 'inspection.md'), '');
  const images = listSlideImages(dir);
  assert.deepEqual(images, ['slide-1.png', 'slide-2.png', 'slide-10.png']);
});

test('buildPublishedRecordは投稿日時とmediaIdを含む', () => {
  const record = buildPublishedRecord('178912345', new Date('2026-08-13T03:31:00.000Z'));
  assert.deepEqual(record, { postedAt: '2026-08-13T03:31:00.000Z', mediaId: '178912345' });
});

test('parseDirArgは--dirの次の値を返す', () => {
  assert.equal(parseDirArg(['--dir', '2026-08-13-a']), '2026-08-13-a');
});

test('parseDirArgは--dirが無ければnullを返す', () => {
  assert.equal(parseDirArg([]), null);
});
