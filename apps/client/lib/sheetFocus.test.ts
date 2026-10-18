import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSheetFocusIntent, type SheetFocusEvent } from './sheetFocusIntent.ts';

describe('resolveSheetFocusIntent (F7)', () => {
  it('maps open and nested open to the title, Motion close to the Motion row', () => {
    assert.equal(resolveSheetFocusIntent('open'), 'title');
    assert.equal(resolveSheetFocusIntent('nestedOpen'), 'title');
    assert.equal(resolveSheetFocusIntent('motionViewClose'), 'motionRow');
    assert.equal(resolveSheetFocusIntent('dismiss'), 'invoker');
  });

  it('returns the same target on every repeat (10×, no timing)', () => {
    const sequence: SheetFocusEvent[] = [
      'open',
      'nestedOpen',
      'motionViewClose',
      'nestedOpen',
      'dismiss',
    ];
    const expected = ['title', 'title', 'motionRow', 'title', 'invoker'] as const;
    for (let i = 0; i < 10; i += 1) {
      for (let j = 0; j < sequence.length; j += 1) {
        assert.equal(resolveSheetFocusIntent(sequence[j]!), expected[j]);
      }
    }
  });
});
