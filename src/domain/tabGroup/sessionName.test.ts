import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveTimestampSessionName } from './sessionName.ts';

test('deriveTimestampSessionName returns a pure timestamp label', () => {
  const result = deriveTimestampSessionName('2026-05-09T03:04:05.000Z');

  assert.match(result, /^\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}$/);
});
