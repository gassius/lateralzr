import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkAudioBudget } from './audio-budget.mjs';

describe('checkAudioBudget', () => {
  it('passes for the committed Sound 3 kit', () => {
    const result = checkAudioBudget();
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.ok(result.nativeBytes > 0);
    assert.ok(result.webBytes > 0);
    assert.ok(result.nativeBytes <= 8 * 1024 * 1024);
    assert.ok(result.webBytes <= 3 * 1024 * 1024);
  });
});
