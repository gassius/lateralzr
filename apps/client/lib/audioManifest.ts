/**
 * Typed consumer for Sound 3 `assets/audio/manifest.json`.
 *
 * Web Audio looping MUST use {@link loopEndSecondsFromManifest} — AAC padding
 * (~14 ms on `music-intro-loop`) makes `AudioBuffer.duration` too long and
 * causes a click/gap if used as `loopEnd`.
 *
 * Prefer {@link getSoundAssetDurationMs} / `getSoundAssetDurationMsForModule`
 * from `lib/soundAssets` when the module id is known; this helper is the
 * durationMs → seconds conversion used at play time.
 */

import rawManifest from '@/assets/audio/manifest.json';

export type AudioManifestAsset = {
  /** Web relative path under `assets/audio/` (e.g. `music/intro-loop.web.m4a`). */
  path: string | null;
  /** Native `.m4a` relative path (Sound 3). */
  nativePath?: string | null;
  /**
   * Artistic duration in milliseconds. Required for seamless loops — drives
   * Web Audio `AudioBufferSourceNode.loopEnd`, not `buffer.duration`.
   */
  durationMs: number | null;
  /** When true, web playback loops with loopEnd from durationMs. */
  loop: boolean;
  gainDb?: number;
  placeholder?: boolean;
  level?: number;
};

export type AudioManifest = {
  version: number;
  sampleRate?: number;
  assets: Record<string, AudioManifestAsset>;
};

export const AUDIO_MANIFEST = rawManifest as AudioManifest;

export function getAudioManifestAsset(name: string): AudioManifestAsset | null {
  const entry = AUDIO_MANIFEST.assets[name];
  return entry ?? null;
}

/**
 * Seconds for `AudioBufferSourceNode.loopEnd`.
 * Prefer manifest `durationMs`; never fall back to decoded buffer length for
 * looped assets (AAC encoder padding).
 */
export function loopEndSecondsFromManifest(
  durationMs: number | null | undefined,
): number | null {
  if (durationMs == null || !(durationMs > 0)) return null;
  return durationMs / 1000;
}
