/**
 * Event → asset table (Sound 1).
 *
 * Variants are placeholders until Sound 3 ships audio files. Empty `variants`
 * makes `soundEvent` a safe no-op for that event. Swapping a file later is a
 * one-line change here (asset module id from `require(...)`).
 *
 * Pitch shift: skipped (audio director 2026-10-24).
 */

import type { SoundBus, SoundEventName } from '@/lib/soundTypes';

/** Asset module id (`require`) or null placeholder until Sound 3. */
export type SoundAssetRef = number | null;

export type SoundMapEntry = {
  bus: SoundBus;
  /** Ordered variants for random pick (never same index twice in a row). */
  variants: readonly SoundAssetRef[];
  /** Min ms between plays of this event (anti-stacking). */
  minIntervalMs: number;
  /** Max concurrent voices for this event (anti-stacking). */
  maxVoices: number;
};

const SFX = (
  minIntervalMs: number,
  maxVoices: number,
  variants: readonly SoundAssetRef[] = [],
): SoundMapEntry => ({
  bus: 'effects',
  variants,
  minIntervalMs,
  maxVoices,
});

const MUSIC = (
  minIntervalMs: number,
  maxVoices: number,
  variants: readonly SoundAssetRef[] = [],
): SoundMapEntry => ({
  bus: 'music',
  variants,
  minIntervalMs,
  maxVoices,
});

/**
 * Central mapping. All variant lists are empty placeholders (Sound 3).
 * Intervals/voice caps are conservative defaults for fast swipe UX.
 */
export const SOUND_MAP: Readonly<Record<SoundEventName, SoundMapEntry>> = {
  card_flip: SFX(50, 2),
  card_flip_back: SFX(50, 2),
  swipe_next: SFX(40, 2),
  swipe_back: SFX(40, 2),
  swipe_cancel: SFX(60, 1),
  swipe_resistance: SFX(120, 1),
  complexity_changed: SFX(80, 1),
  laterality_step: SFX(80, 1),
  reshuffle_started: SFX(100, 1),
  reshuffle_landed: SFX(100, 1),
  card_arrived: SFX(40, 2),
  sheet_open: SFX(80, 1),
  sheet_close: SFX(80, 1),
  error_soft: SFX(150, 1),
  no_match: SFX(150, 1),
  intro_started: MUSIC(0, 1),
  intro_ready: MUSIC(0, 1),
};

export function getSoundMapEntry(name: SoundEventName): SoundMapEntry {
  return SOUND_MAP[name];
}

/** Resolved playable assets only (drops null / missing placeholders). */
export function playableVariants(entry: SoundMapEntry): SoundAssetRef[] {
  return entry.variants.filter((v): v is number => typeof v === 'number');
}
