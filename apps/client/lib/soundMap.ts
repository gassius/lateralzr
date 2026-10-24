/**
 * Event → asset table (Sound 1 + Sound 3).
 *
 * Variants come from {@link SOUND_VARIANT_GROUPS} / `require` module ids in
 * `lib/soundAssets.ts` (web: `soundAssets.web.ts`). Empty lists stay a no-op.
 *
 * Pitch shift: skipped (audio director 2026-10-24).
 */

import {
  resolveVariantModules,
  SOUND_VARIANT_GROUPS,
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
