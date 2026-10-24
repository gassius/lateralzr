import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getSoundAsset,
  getSoundAssetDurationMs,
  SOUND_ASSETS,
  SOUND_VARIANT_GROUPS,
  type SoundAssetName,
} from '@/lib/soundAssets';
import type { SoundEventName } from '@/lib/soundTypes';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, '../assets/audio/manifest.json'), 'utf8'),
) as {
  version: number;
  assets: Record<
    string,
    {
      path: string | null;
      nativePath?: string | null;
      durationMs: number | null;
      loop: boolean;
      placeholder?: boolean;
      level?: number;
    }
  >;
};

test('manifest is Sound 8 shape with real director paths', () => {
  assert.equal(manifest.version, 1);
  assert.ok(manifest.assets);
  assert.equal(Object.keys(manifest.assets).length, Object.keys(SOUND_ASSETS).length);
});

test('every require-map asset has matching manifest durationMs and path', () => {
  for (const name of Object.keys(SOUND_ASSETS) as SoundAssetName[]) {
    const meta = getSoundAsset(name);
    const entry = manifest.assets[name];
    assert.ok(entry, `manifest missing ${name}`);
    assert.equal(typeof entry.path, 'string');
    assert.ok((entry.path as string).length > 0);
    assert.equal(meta.durationMs, entry.durationMs);
    assert.equal(meta.loop, entry.loop);
    assert.equal(getSoundAssetDurationMs(name), entry.durationMs);
    assert.equal(typeof meta.module, 'number');
  }
});

test('music-texture-tonedrift-c stays a placeholder', () => {
  assert.equal(SOUND_ASSETS['music-texture-tonedrift-c'].placeholder, true);
  assert.equal(manifest.assets['music-texture-tonedrift-c']?.placeholder, true);
});

test('intro-loop durationMs is director-measured (Sound 8 loopEnd)', () => {
  assert.equal(getSoundAssetDurationMs('music-intro-loop'), 6000);
  assert.equal(manifest.assets['music-intro-loop']?.durationMs, 6000);
  assert.equal(manifest.assets['music-intro-loop']?.loop, true);
});

test('every Sound 1 event variant group is non-empty', () => {
  const events: SoundEventName[] = [
    'card_flip',
    'card_flip_back',
    'swipe_next',
    'swipe_back',
    'swipe_cancel',
    'swipe_resistance',
    'complexity_changed',
    'laterality_step',
    'reshuffle_started',
    'reshuffle_landed',
    'card_arrived',
    'sheet_open',
    'sheet_close',
    'error_soft',
    'no_match',
    'intro_started',
    'intro_ready',
  ];
  for (const name of events) {
    const group = SOUND_VARIANT_GROUPS[name];
    assert.ok(group, `missing variant group for ${name}`);
    assert.ok(group.length >= 1, `empty variant group for ${name}`);
  }
});
