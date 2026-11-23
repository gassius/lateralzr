import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_SCREENS, mapChangedFilesToScreens } from './map-changed-screens.mjs';

describe('mapChangedFilesToScreens', () => {
  it('defaults to CardFront for empty / docs-only', () => {
    assert.deepEqual(mapChangedFilesToScreens([]), ['CardFront']);
    assert.deepEqual(mapChangedFilesToScreens(['README.md']), ['CardFront']);
  });

  it('maps ConceptCard to front + back', () => {
    assert.deepEqual(
      mapChangedFilesToScreens(['apps/client/components/ConceptCard.tsx']),
      ['CardFront', 'CardBack'],
    );
  });

  it('maps LateralityControl to LateralityBar', () => {
    assert.deepEqual(
      mapChangedFilesToScreens(['apps/client/components/LateralityControl.tsx']),
      ['LateralityBar'],
    );
  });

  it('capture tooling → all screens', () => {
    assert.deepEqual(
      mapChangedFilesToScreens(['scripts/web-preview-capture/capture-screens.mjs']),
      [...ALL_SCREENS],
    );
    assert.deepEqual(
      mapChangedFilesToScreens(['.github/workflows/web-preview-screenshots.yml']),
      [...ALL_SCREENS],
    );
  });
});
