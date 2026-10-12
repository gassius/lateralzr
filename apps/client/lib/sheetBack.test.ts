import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSheetHardwareBack } from './sheetBack.ts';

describe('resolveSheetHardwareBack', () => {
  it('returns nestedBack when the sheet has an onBack handler (Complexity / Language)', () => {
    assert.equal(resolveSheetHardwareBack(true), 'nestedBack');
  });

  it('returns dismiss when there is no nested back (root menu)', () => {
    assert.equal(resolveSheetHardwareBack(false), 'dismiss');
  });
});
