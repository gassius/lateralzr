import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sheetTabWrapIndex } from '@/lib/sheetFocusTrap';

describe('sheetTabWrapIndex', () => {
  it('wraps Tab from last to first and Shift+Tab from first to last', () => {
    assert.equal(sheetTabWrapIndex(3, 2, false), 0);
    assert.equal(sheetTabWrapIndex(3, 0, true), 2);
    assert.equal(sheetTabWrapIndex(3, -1, false), 0);
    assert.equal(sheetTabWrapIndex(3, -1, true), 2);
  });

  it('lets the browser move when focus stays inside the list', () => {
    assert.equal(sheetTabWrapIndex(3, 0, false), null);
    assert.equal(sheetTabWrapIndex(3, 1, false), null);
    assert.equal(sheetTabWrapIndex(3, 1, true), null);
    assert.equal(sheetTabWrapIndex(3, 2, true), null);
  });

  it('returns null for an empty set', () => {
    assert.equal(sheetTabWrapIndex(0, -1, false), null);
  });
});
