import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInspectionMd } from './inspection-md.mjs';
import { PASS_PATTERN } from '../detect-pending.mjs';

test('buildInspectionMdはdetect-pending.mjsのPASS_PATTERNに一致する', () => {
  const md = buildInspectionMd(1);
  assert.match(md, PASS_PATTERN);
});

test('buildInspectionMdは試行回数を含む', () => {
  const md = buildInspectionMd(2);
  assert.match(md, /第2回/);
});
