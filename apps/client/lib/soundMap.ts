/**
 * Event → asset table (Sound 1 + Sound 3) + Sound 9 mix / gain table.
 *
 * Variants come from {@link SOUND_VARIANT_GROUPS} / `require` module ids in
 * `lib/soundAssets.ts` (web: `soundAssets.web.ts`). Empty lists stay a no-op.
 *
 * Pitch shift: skipped (audio director 2026-10-24).
 * Tone layers: internal QA A/B flag only (not a user setting) — default OFF.
 * Gain: per-file `gainDb` in the manifest / SOUND_ASSETS (same native + web).
 */

import {
  resolveVariantModules,
  SOUND_ASSETS,
  SOUND_VARIANT_GROUPS,
  type SoundAssetName,
} from '@/lib/soundAssets';
import type { SoundBus, SoundEventName } from '@/lib/soundTypes';

// --- Sound 9 mix policy (audio director 2026-10-24) ---

/** Max simultaneous effects voices; a new one cuts the oldest cuttable. */
export const MAX_CONCURRENT_EFFECTS = 2;

/** Fade when cutting an older effect to free a voice. */
export const EFFECT_CUT_FADE_MS = 30;

/** Ignore retrigger of the same effect within this window. */
export const EFFECT_RETRIGGER_IGNORE_MS = 60;

/** Duck music while any effect is playing. */
export const EFFECT_MUSIC_DUCK_DB = -3;
export const EFFECT_MUSIC_DUCK_ATTACK_MS = 50;
export const EFFECT_MUSIC_DUCK_RELEASE_MS = 400;

/** Laterality-row stagger (step → sheet_close → gather). */
export const LATERALITY_SHEET_CLOSE_DELAY_MS = 80;
export const LATERALITY_GATHER_DELAY_MS = 250;
export const LATERALITY_SHEET_CLOSE_ATTENUATION_DB = -3;

/** Meaning-carrying effects — never cut to free a voice. */
export const MEANING_CARRYING_EFFECTS: ReadonlySet<SoundEventName> = new Set([
  'laterality_step',
  'error_soft',
]);

/**
 * Director ear targets relative to swipe / bed = 0 (kickoff 2026-10-24).
 * Not played as-is — see {@link GAIN_DB_PLATFORM_OFFSET}.
 */
export const DIRECTOR_RELATIVE_GAIN_DB: Readonly<Record<SoundAssetName, number>> = {
  'music-bed-calm-a': 0,
  'music-bed-bright-b': 0,
  'music-texture-shimmer-a': -4,
  'music-texture-subswell-b': -4,
  'music-texture-tonedrift-c': -4,
  'music-texture-air-d': -4,
  'music-intro-loop': 0,
  'music-intro-arrival-a': 1,
  'music-intro-arrival-b': 1,
  'music-dropin-01': -3,
  'music-dropin-02': -3,
  'music-dropin-03': -3,
  'music-dropin-04': -3,
  'music-dropin-05': -3,
  'music-dropin-06': -3,
  'music-dropin-07': -3,
  'music-dropin-08': -3,
  'music-dropin-09': -3,
  'music-dropin-10': -3,
  'music-dropin-11': -3,
  'music-dropin-12': -3,
  'music-dropin-13': -3,
  'music-dropin-14': -3,
  'music-dropin-15': -3,
  'music-dropin-16': -3,
  'music-dropin-17': -3,
  'music-dropin-18': -3,
  'music-dropin-19': -3,
  'music-dropin-20': -3,
  'music-dropin-21': -3,
  'music-dropin-22': -3,
  'music-dropin-23': -3,
  'music-dropin-24': -3,
  'sfx-swipe-next-a': 0,
  'sfx-swipe-next-b': 0,
  'sfx-swipe-next-c': 0,
  'sfx-swipe-back-a': 0,
  'sfx-swipe-tone-up': -10,
  'sfx-swipe-tone-down': -10,
  'sfx-card-flip-a': 0,
  'sfx-card-flip-c': 0,
  'sfx-card-flip-back-a': 0,
  'sfx-card-flip-back-c': 0,
  'sfx-swipe-cancel-a': 0,
  'sfx-swipe-cancel-b': 0,
  'sfx-swipe-resistance-a': 0,
  'sfx-swipe-resistance-b': 0,
  'sfx-complexity-1': 0,
  'sfx-complexity-2': 0,
  'sfx-complexity-3': 0,
  'sfx-complexity-4': 0,
  'sfx-complexity-5': 0,
  'sfx-laterality-snap-1': 2,
  'sfx-laterality-snap-2': 2,
  'sfx-laterality-snap-3': 2,
  'sfx-laterality-snap-4': 2,
  'sfx-laterality-snap-5': 2,
  'sfx-reshuffle-gather': -2,
  'sfx-reshuffle-land-a': 0,
  'sfx-reshuffle-land-b': 0,
  'sfx-reshuffle-land-wide': 0,
  'sfx-card-arrive-a': -2,
  'sfx-card-arrive-b': -2,
  'sfx-sheet-open': 0,
  'sfx-sheet-close': 0,
  'sfx-error-soft-a': 0,
  'sfx-error-soft-b': 0,
  'sfx-no-match-soft': 0,
};

/**
 * Shift relative table so the loudest asset is 0 dB.
 * Linear volume stays ≤ 1 on web and music (native was uncapped before).
 */
export const GAIN_DB_PLATFORM_OFFSET = -2;

/** Applied gainDb (relative + offset). Manifest / SOUND_ASSETS stay in sync. */
export const DIRECTOR_GAIN_DB: Readonly<Record<SoundAssetName, number>> = Object.fromEntries(
  (Object.keys(DIRECTOR_RELATIVE_GAIN_DB) as SoundAssetName[]).map((name) => [
    name,
    DIRECTOR_RELATIVE_GAIN_DB[name] + GAIN_DB_PLATFORM_OFFSET,
  ]),
) as Readonly<Record<SoundAssetName, number>>;

/** Applied platform gainDb for an asset (≤ 0). */
export function getDirectorGainDb(name: SoundAssetName): number {
  return DIRECTOR_GAIN_DB[name] ?? GAIN_DB_PLATFORM_OFFSET;
}

/** Look up authored `gainDb` for a `require` module id (native + web). */
export function getSoundAssetGainDbForModule(moduleId: number): number {
  for (const name of Object.keys(SOUND_ASSETS) as SoundAssetName[]) {
    if (SOUND_ASSETS[name].module === moduleId) {
      return SOUND_ASSETS[name].gainDb;
    }
  }
  return 0;
}

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

/**
 * Tone layer under swipe air when {@link ENABLE_SWIPE_TONE_LAYERS} is on.
 * Matches manifest `sfx-swipe-tone-*` gainDb (−10); engine uses the asset value.
 */
export const SWIPE_TONE_LAYER_GAIN_DB = -10;

/** Motion-tied SFX under reduced motion (director: ~3 dB lower; no separate files). */
export const REDUCED_MOTION_SFX_GAIN_DB = -3;

/**
 * Under reduced motion, big-movement SFX also get a shortened play + fade-out
 * (no separate files — volume ramp in the engine).
 */
export const REDUCED_MOTION_SFX_PLAY_RATIO = 0.45;
export const REDUCED_MOTION_SFX_FADE_MS = 60;

/** Events that follow card / swipe motion (RM gain applies). */
export const MOTION_TIED_SOUND_EVENTS: ReadonlySet<SoundEventName> = new Set([
  'card_flip',
  'card_flip_back',
  'swipe_next',
  'swipe_back',
  'swipe_cancel',
  'swipe_resistance',
  'complexity_changed',
  'laterality_step',
  'card_arrived',
]);

/**
 * Big-movement sweeps (reshuffle / sheet) — RM gain + shortened fade (Sound 5).
 * Overlaps motion-tied for gain; fade shortening is gated on this set only.
 */
export const BIG_MOVEMENT_SOUND_EVENTS: ReadonlySet<SoundEventName> = new Set([
  'reshuffle_started',
  'reshuffle_landed',
  'sheet_open',
  'sheet_close',
]);

/** Linear gain from dB. */
export function gainFromDb(db: number): number {
  return Math.pow(10, db / 20);
}

/** Play volume for an event (asset gainDb + optional RM attenuation). Clamped to [0, 1]. */
export function resolveEventGain(
  assetGainDb: number,
  eventName: SoundEventName,
  reduceMotion: boolean,
): number {
  let db = assetGainDb;
  if (
    reduceMotion &&
    (MOTION_TIED_SOUND_EVENTS.has(eventName) ||
      BIG_MOVEMENT_SOUND_EVENTS.has(eventName))
  ) {
    db += REDUCED_MOTION_SFX_GAIN_DB;
  }
  return Math.max(0, Math.min(1, gainFromDb(db)));
}

/** Whether RM should shorten the play + fade-out for this event. */
export function shouldShortenReducedMotionFade(eventName: SoundEventName): boolean {
  return BIG_MOVEMENT_SOUND_EVENTS.has(eventName);
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
