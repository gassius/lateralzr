import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isClientTestOrDevBuild, resolveE2ePulsePeak } from './e2eFlags.ts';

describe('e2eFlags (Lz-40 pulse peak gate)', () => {
  it('resolveE2ePulsePeak is false when not requested', () => {
    assert.equal(resolveE2ePulsePeak(undefined), false);
    assert.equal(resolveE2ePulsePeak(false), false);
  });

  it('resolveE2ePulsePeak follows isClientTestOrDevBuild when requested', () => {
    const allowed = isClientTestOrDevBuild();
    assert.equal(resolveE2ePulsePeak(true), allowed);
  });

  it('isClientTestOrDevBuild is true under EXPO_PUBLIC_E2E=1', () => {
    const prev = process.env.EXPO_PUBLIC_E2E;
    process.env.EXPO_PUBLIC_E2E = '1';
    try {
      assert.equal(isClientTestOrDevBuild(), true);
      assert.equal(resolveE2ePulsePeak(true), true);
    } finally {
      if (prev == null) delete process.env.EXPO_PUBLIC_E2E;
      else process.env.EXPO_PUBLIC_E2E = prev;
    }
  });

  it('isClientTestOrDevBuild is true for the Client E2E API base', () => {
    const prevE2e = process.env.EXPO_PUBLIC_E2E;
    const prevApi = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_E2E;
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4173';
    try {
      assert.equal(isClientTestOrDevBuild(), true);
      assert.equal(resolveE2ePulsePeak(true), true);
    } finally {
      if (prevE2e == null) delete process.env.EXPO_PUBLIC_E2E;
      else process.env.EXPO_PUBLIC_E2E = prevE2e;
      if (prevApi == null) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = prevApi;
    }
  });

  it('isClientTestOrDevBuild is false when E2E flags unset and not __DEV__', () => {
    const prevE2e = process.env.EXPO_PUBLIC_E2E;
    const prevApi = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_E2E;
    delete process.env.EXPO_PUBLIC_API_URL;
    try {
      // Node unit tests: __DEV__ is typically undefined/false.
      if (typeof __DEV__ === 'undefined' || !__DEV__) {
        assert.equal(isClientTestOrDevBuild(), false);
        assert.equal(resolveE2ePulsePeak(true), false);
      }
    } finally {
      if (prevE2e == null) delete process.env.EXPO_PUBLIC_E2E;
      else process.env.EXPO_PUBLIC_E2E = prevE2e;
      if (prevApi == null) delete process.env.EXPO_PUBLIC_API_URL;
      else process.env.EXPO_PUBLIC_API_URL = prevApi;
    }
  });
});
