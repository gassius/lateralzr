import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDiagOptIn } from './diagBuildFlags.ts';

describe('parseDiagOptIn', () => {
  it('defaults missing, blank, and unknown values to Off', () => {
    assert.equal(parseDiagOptIn(undefined), false);
    assert.equal(parseDiagOptIn(null), false);
    assert.equal(parseDiagOptIn(''), false);
    assert.equal(parseDiagOptIn('  '), false);
    assert.equal(parseDiagOptIn('maybe'), false);
    assert.equal(parseDiagOptIn('false'), false);
    assert.equal(parseDiagOptIn('0'), false);
  });

  it('treats 1 / true / on / yes as On (case-insensitive)', () => {
    assert.equal(parseDiagOptIn('1'), true);
    assert.equal(parseDiagOptIn('true'), true);
    assert.equal(parseDiagOptIn('TRUE'), true);
    assert.equal(parseDiagOptIn('on'), true);
    assert.equal(parseDiagOptIn('yes'), true);
    assert.equal(parseDiagOptIn(' Yes '), true);
  });
});
