/**
 * Event → asset table (Sound 1 + Sound 3).
 *
 * Variants come from {@link SOUND_VARIANT_GROUPS} / `require` module ids in
 * `lib/soundAssets.ts` (web: `soundAssets.web.ts`). Empty lists stay a no-op.
 *
 * Pitch shift: skipped (audio director 2026-10-24).
 * Tone layers: internal QA A/B flag only (not a user setting) — default OFF.
 */

import {
  resolveVariantModules,
  SOUND_ASSETS,
  SOUND_VARIANT_GROUPS,
  type SoundAssetName,
} from '@/lib/soundAssets';
import type { SoundBus, SoundEventName } from '@/lib/soundTypes';

/** Asset module id (`require`) or null placeholder. */
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

/**
 * Internal QA A/B: optional sine glide under swipe air (~-10 dB).
 * Off by default (audio director 2026-10-24). Flip to `true` for A/B listens.
 * Not a user setting — do not wire to Sound 2 prefs.
 */
export const ENABLE_SWIPE_TONE_LAYERS = false;

/** Tone layer under swipe air when {@link ENABLE_SWIPE_TONE_LAYERS} is on. */
export const SWIPE_TONE_LAYER_GAIN_DB = -10;

/** Motion-tied SFX under reduced motion (director: ~3 dB lower; no separate files). */
export const REDUCED_MOTION_SFX_GAIN_DB = -3;

/** Events that follow card / swipe motion (RM gain applies). */
export const MOTION_TIED_SOUND_EVENTS: ReadonlySet<SoundEventName> = new Set([
  'card_flip',
  'card_flip_back',
  'swipe_next',
  'swipe_back',
  'swipe_cancel',
  'swipe_resistance',
  'complexity_changed',
]);

/** Linear gain from dB. */
export function gainFromDb(db: number): number {
  return Math.pow(10, db / 20);
}

/** Play volume for an event (asset gainDb + optional RM attenuation). */
export function resolveEventGain(
  assetGainDb: number,
  eventName: SoundEventName,
  reduceMotion: boolean,
): number {
  let db = assetGainDb;
  if (reduceMotion && MOTION_TIED_SOUND_EVENTS.has(eventName)) {
    db += REDUCED_MOTION_SFX_GAIN_DB;
  }
  return gainFromDb(db);
}

/** Tone asset under swipe_next / swipe_back when the QA flag is on. */
export function swipeToneAssetName(
  swipe: 'swipe_next' | 'swipe_back',
): SoundAssetName {
  return swipe === 'swipe_next' ? 'sfx-swipe-tone-up' : 'sfx-swipe-tone-down';
}

export function swipeToneModule(
  swipe: 'swipe_next' | 'swipe_back',
): SoundAssetRef {
  return SOUND_ASSETS[swipeToneAssetName(swipe)].module;
}

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
 * Central mapping. Variant lists resolve through Sound 3 asset groups so
 * adding/replacing a file is a one-line group change (no call-site edits).
 */
export const SOUND_MAP: Readonly<Record<SoundEventName, SoundMapEntry>> = {
  card_flip: SFX(50, 2, resolveVariantModules(SOUND_VARIANT_GROUPS.card_flip)),
  card_flip_back: SFX(
    50,
    2,
    resolveVariantModules(SOUND_VARIANT_GROUPS.card_flip_back),
  ),
  swipe_next: SFX(40, 2, resolveVariantModules(SOUND_VARIANT_GROUPS.swipe_next)),
  swipe_back: SFX(40, 2, resolveVariantModules(SOUND_VARIANT_GROUPS.swipe_back)),
  swipe_cancel: SFX(
    60,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.swipe_cancel),
  ),
  swipe_resistance: SFX(
    120,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.swipe_resistance),
  ),
  complexity_changed: SFX(
    80,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.complexity_changed),
  ),
  laterality_step: SFX(
    80,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.laterality_step),
  ),
  reshuffle_started: SFX(
    100,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.reshuffle_started),
  ),
  reshuffle_landed: SFX(
    100,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.reshuffle_landed),
  ),
  card_arrived: SFX(
    40,
    2,
    resolveVariantModules(SOUND_VARIANT_GROUPS.card_arrived),
  ),
  sheet_open: SFX(80, 1, resolveVariantModules(SOUND_VARIANT_GROUPS.sheet_open)),
  sheet_close: SFX(
    80,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.sheet_close),
  ),
  error_soft: SFX(150, 1, resolveVariantModules(SOUND_VARIANT_GROUPS.error_soft)),
  no_match: SFX(150, 1, resolveVariantModules(SOUND_VARIANT_GROUPS.no_match)),
  intro_started: MUSIC(
    0,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.intro_started),
  ),
  intro_ready: MUSIC(
    0,
    1,
    resolveVariantModules(SOUND_VARIANT_GROUPS.intro_ready),
  ),
};

export function getSoundMapEntry(name: SoundEventName): SoundMapEntry {
  return SOUND_MAP[name];
}

/** Resolved playable assets only (drops null / missing placeholders). */
export function playableVariants(entry: SoundMapEntry): SoundAssetRef[] {
  return entry.variants.filter((v): v is number => typeof v === 'number');
}
