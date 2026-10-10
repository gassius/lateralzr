import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type } from './tokens.ts';
import {
  textStyle,
  typeLineHeightRatio,
  typeSize,
  typeWeight,
  type TypeRole,
} from './typography.ts';

const ROLES: TypeRole[] = ['concept', 'sheetTitle', 'body', 'row', 'label', 'meta'];

describe('v3.3 typography roles', () => {
  it('maps sizes to §23 type tokens', () => {
    assert.equal(typeSize('concept'), type.concept);
    assert.equal(typeSize('sheetTitle'), type.sheetTitle);
    assert.equal(typeSize('body'), type.body);
    assert.equal(typeSize('row'), type.row);
    assert.equal(typeSize('label'), type.label);
    assert.equal(typeSize('meta'), type.meta);
    assert.equal(type.concept, 32);
    assert.equal(type.sheetTitle, 24);
    assert.equal(type.body, 18);
    assert.equal(type.row, 17);
    assert.equal(type.label, 14);
    assert.equal(type.meta, 13);
  });

  it('picks §7.2 weights and line-height ratios (Critiquito concept 32/700/1.15)', () => {
    assert.equal(typeWeight('concept'), '700');
    assert.equal(typeLineHeightRatio('concept'), 1.15);
    assert.equal(typeWeight('sheetTitle'), '700');
    assert.equal(typeLineHeightRatio('sheetTitle'), 1.2);
    assert.equal(typeWeight('body'), '400');
    assert.equal(typeLineHeightRatio('body'), 1.5);
    assert.equal(typeWeight('row'), '500');
    assert.equal(typeLineHeightRatio('row'), 1.4);
    assert.equal(typeWeight('label'), '500');
    assert.equal(typeLineHeightRatio('label'), 1.4);
    assert.equal(typeWeight('meta'), '400');
    assert.equal(typeLineHeightRatio('meta'), 1.4);
  });

  it('builds textStyle without fontFamily', () => {
    for (const role of ROLES) {
      const style = textStyle(role);
      assert.equal(style.fontSize, typeSize(role));
      assert.equal(style.fontWeight, typeWeight(role));
      assert.equal(
        Object.prototype.hasOwnProperty.call(style, 'fontFamily'),
        false,
      );
    }
  });

  it('returns unscaled lineHeight (RN scales fontSize and lineHeight together)', () => {
    const row = textStyle('row');
    assert.equal(row.lineHeight, Math.round(17 * 1.4));
    assert.equal(row.fontSize, 17);

    const concept = textStyle('concept');
    assert.equal(concept.lineHeight, Math.round(32 * 1.15));
    assert.equal(concept.fontSize, 32);

    const body = textStyle('body');
    assert.equal(body.lineHeight, Math.round(18 * 1.5));
  });

  it('allows weight override without changing size', () => {
    const style = textStyle('row', { fontWeight: '400' });
    assert.equal(style.fontWeight, '400');
    assert.equal(style.fontSize, 17);
  });
});
