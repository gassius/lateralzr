import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBuildSwitch, resolveShowMediaCredits, resolveShowReferenceLinks } from './buildFlags.ts';
import { isClientTestOrDevBuild } from './e2eFlags.ts';

describe('parseBuildSwitch', () => {
  it('defaults missing, blank, and invalid values to On', () => {
    assert.equal(parseBuildSwitch(undefined), true);
    assert.equal(parseBuildSwitch(null), true);
    assert.equal(parseBuildSwitch(''), true);
    assert.equal(parseBuildSwitch('  '), true);
    assert.equal(parseBuildSwitch('true'), true);
    assert.equal(parseBuildSwitch('1'), true);
    assert.equal(parseBuildSwitch('yes'), true);
    assert.equal(parseBuildSwitch('on'), true);
    assert.equal(parseBuildSwitch('maybe'), true);
  });

  it('treats only false and 0 as Off', () => {
    assert.equal(parseBuildSwitch('false'), false);
    assert.equal(parseBuildSwitch('FALSE'), false);
    assert.equal(parseBuildSwitch('0'), false);
    assert.equal(parseBuildSwitch(' 0 '), false);
  });
});

describe('E2E overrides', () => {
  it('honour query overrides only in test/dev builds', () => {
    const allowed = isClientTestOrDevBuild();
    assert.equal(resolveShowReferenceLinks({ onlyWithMedia: false, e2eShowReferenceLinks: false }), allowed ? false : true);
    assert.equal(resolveShowMediaCredits({ onlyWithMedia: false, e2eShowMediaCredits: false }), allowed ? false : true);
    assert.equal(resolveShowReferenceLinks({ onlyWithMedia: false }), true);
    assert.equal(resolveShowMediaCredits({ onlyWithMedia: false }), true);
  });
});
