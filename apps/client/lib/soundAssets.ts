/**
 * Sound 3 — typed audio asset index (native `.m4a`).
 *
 * Asset List names (`music-*` / `sfx-*`) map to `require(...)` module ids.
 * Web resolves `soundAssets.web.ts` (`.web.m4a`). Metadata (incl. `durationMs`
 * for Sound 8 `loopEnd`) comes from `assets/audio/manifest.json`.
 *
 * `music-texture-tonedrift-c` is a placeholder (`placeholder: true`) — not final.
 */

export type SoundAssetName =
  | 'music-bed-calm-a'
  | 'music-bed-bright-b'
  | 'music-texture-shimmer-a'
  | 'music-texture-subswell-b'
  | 'music-texture-tonedrift-c'
  | 'music-texture-air-d'
  | 'music-intro-loop'
  | 'music-intro-arrival-a'
  | 'music-intro-arrival-b'
  | 'music-dropin-01'
  | 'music-dropin-02'
  | 'music-dropin-03'
  | 'music-dropin-04'
  | 'music-dropin-05'
  | 'music-dropin-06'
  | 'music-dropin-07'
  | 'music-dropin-08'
  | 'music-dropin-09'
  | 'music-dropin-10'
  | 'music-dropin-11'
  | 'music-dropin-12'
  | 'music-dropin-13'
  | 'music-dropin-14'
  | 'music-dropin-15'
  | 'music-dropin-16'
  | 'music-dropin-17'
  | 'music-dropin-18'
  | 'music-dropin-19'
  | 'music-dropin-20'
  | 'music-dropin-21'
  | 'music-dropin-22'
  | 'music-dropin-23'
  | 'music-dropin-24'
  | 'sfx-swipe-next-a'
  | 'sfx-swipe-next-b'
  | 'sfx-swipe-next-c'
  | 'sfx-swipe-back-a'
  | 'sfx-swipe-tone-up'
  | 'sfx-swipe-tone-down'
  | 'sfx-card-flip-a'
  | 'sfx-card-flip-c'
  | 'sfx-card-flip-back-a'
  | 'sfx-card-flip-back-c'
  | 'sfx-swipe-cancel-a'
  | 'sfx-swipe-cancel-b'
  | 'sfx-swipe-resistance-a'
  | 'sfx-swipe-resistance-b'
  | 'sfx-complexity-1'
  | 'sfx-complexity-2'
  | 'sfx-complexity-3'
  | 'sfx-complexity-4'
  | 'sfx-complexity-5'
  | 'sfx-laterality-snap-1'
  | 'sfx-laterality-snap-2'
  | 'sfx-laterality-snap-3'
  | 'sfx-laterality-snap-4'
  | 'sfx-laterality-snap-5'
  | 'sfx-reshuffle-gather'
  | 'sfx-reshuffle-land-a'
  | 'sfx-reshuffle-land-b'
  | 'sfx-reshuffle-land-wide'
  | 'sfx-card-arrive-a'
  | 'sfx-card-arrive-b'
  | 'sfx-sheet-open'
  | 'sfx-sheet-close'
  | 'sfx-error-soft-a'
  | 'sfx-error-soft-b'
  | 'sfx-no-match-soft';

export type SoundAssetMeta = {
  /** Metro / expo-audio module id from `require(...)`. */
  module: number;
  /** Exact media duration (ms) — use for Sound 8 web `loopEnd`. */
  durationMs: number;
  loop: boolean;
  gainDb: number;
  /** When true, asset is a temporary stand-in (not final). */
  placeholder?: boolean;
  /** Tone layers default off (director). */
  defaultEnabled?: boolean;
  /** Complexity / laterality ladder step when applicable. */
  level?: number;
};

export const SOUND_ASSETS = {
  'music-bed-calm-a': {
    module: require('../assets/audio/music/bed-calm-a.m4a') as number,
    durationMs: 45000,
    loop: true,
    gainDb: -2,
  },
  'music-bed-bright-b': {
    module: require('../assets/audio/music/bed-bright-b.m4a') as number,
    durationMs: 45000,
    loop: true,
    gainDb: -2,
  },
  'music-texture-shimmer-a': {
    module: require('../assets/audio/music/texture-shimmer-a.m4a') as number,
    durationMs: 23000,
    loop: true,
    gainDb: -6,
  },
  'music-texture-subswell-b': {
    module: require('../assets/audio/music/texture-subswell-b.m4a') as number,
    durationMs: 29000,
    loop: true,
    gainDb: -6,
  },
  'music-texture-tonedrift-c': {
    module: require('../assets/audio/music/texture-tonedrift-c.m4a') as number,
    durationMs: 37000,
    loop: true,
    gainDb: -6,
    placeholder: true,
  },
  'music-texture-air-d': {
    module: require('../assets/audio/music/texture-air-d.m4a') as number,
    durationMs: 41000,
    loop: true,
    gainDb: -6,
  },
  'music-intro-loop': {
    module: require('../assets/audio/music/intro-loop.m4a') as number,
    durationMs: 6000,
    loop: true,
    gainDb: -2,
  },
  'music-intro-arrival-a': {
    module: require('../assets/audio/music/intro-arrival-a.m4a') as number,
    durationMs: 1500,
    loop: false,
    gainDb: -1,
  },
  'music-intro-arrival-b': {
    module: require('../assets/audio/music/intro-arrival-b.m4a') as number,
    durationMs: 1500,
    loop: false,
    gainDb: -1,
  },
  'music-dropin-01': {
    module: require('../assets/audio/music/dropin-01.m4a') as number,
    durationMs: 4300,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-02': {
    module: require('../assets/audio/music/dropin-02.m4a') as number,
    durationMs: 4600,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-03': {
    module: require('../assets/audio/music/dropin-03.m4a') as number,
    durationMs: 4700,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-04': {
    module: require('../assets/audio/music/dropin-04.m4a') as number,
    durationMs: 5700,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-05': {
    module: require('../assets/audio/music/dropin-05.m4a') as number,
    durationMs: 7200,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-06': {
    module: require('../assets/audio/music/dropin-06.m4a') as number,
    durationMs: 4400,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-07': {
    module: require('../assets/audio/music/dropin-07.m4a') as number,
    durationMs: 4100,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-08': {
    module: require('../assets/audio/music/dropin-08.m4a') as number,
    durationMs: 4100,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-09': {
    module: require('../assets/audio/music/dropin-09.m4a') as number,
    durationMs: 4100,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-10': {
    module: require('../assets/audio/music/dropin-10.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-11': {
    module: require('../assets/audio/music/dropin-11.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-12': {
    module: require('../assets/audio/music/dropin-12.m4a') as number,
    durationMs: 5400,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-13': {
    module: require('../assets/audio/music/dropin-13.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-14': {
    module: require('../assets/audio/music/dropin-14.m4a') as number,
    durationMs: 4200,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-15': {
    module: require('../assets/audio/music/dropin-15.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-16': {
    module: require('../assets/audio/music/dropin-16.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-17': {
    module: require('../assets/audio/music/dropin-17.m4a') as number,
    durationMs: 4500,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-18': {
    module: require('../assets/audio/music/dropin-18.m4a') as number,
    durationMs: 4400,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-19': {
    module: require('../assets/audio/music/dropin-19.m4a') as number,
    durationMs: 4000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-20': {
    module: require('../assets/audio/music/dropin-20.m4a') as number,
    durationMs: 4100,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-21': {
    module: require('../assets/audio/music/dropin-21.m4a') as number,
    durationMs: 6900,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-22': {
    module: require('../assets/audio/music/dropin-22.m4a') as number,
    durationMs: 4500,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-23': {
    module: require('../assets/audio/music/dropin-23.m4a') as number,
    durationMs: 5000,
    loop: false,
    gainDb: -5,
  },
  'music-dropin-24': {
    module: require('../assets/audio/music/dropin-24.m4a') as number,
    durationMs: 4200,
    loop: false,
    gainDb: -5,
  },
  'sfx-swipe-next-a': {
    module: require('../assets/audio/sfx/swipe-next-a.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-next-b': {
    module: require('../assets/audio/sfx/swipe-next-b.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-next-c': {
    module: require('../assets/audio/sfx/swipe-next-c.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-back-a': {
    module: require('../assets/audio/sfx/swipe-back-a.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-tone-up': {
    module: require('../assets/audio/sfx/swipe-tone-up.m4a') as number,
    durationMs: 450,
    loop: false,
    gainDb: -12,
    defaultEnabled: false,
  },
  'sfx-swipe-tone-down': {
    module: require('../assets/audio/sfx/swipe-tone-down.m4a') as number,
    durationMs: 450,
    loop: false,
    gainDb: -12,
    defaultEnabled: false,
  },
  'sfx-card-flip-a': {
    module: require('../assets/audio/sfx/card-flip-a.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-card-flip-c': {
    module: require('../assets/audio/sfx/card-flip-c.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-card-flip-back-a': {
    module: require('../assets/audio/sfx/card-flip-back-a.m4a') as number,
    durationMs: 460,
    loop: false,
    gainDb: -2,
  },
  'sfx-card-flip-back-c': {
    module: require('../assets/audio/sfx/card-flip-back-c.m4a') as number,
    durationMs: 480,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-cancel-a': {
    module: require('../assets/audio/sfx/swipe-cancel-a.m4a') as number,
    durationMs: 250,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-cancel-b': {
    module: require('../assets/audio/sfx/swipe-cancel-b.m4a') as number,
    durationMs: 250,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-resistance-a': {
    module: require('../assets/audio/sfx/swipe-resistance-a.m4a') as number,
    durationMs: 220,
    loop: false,
    gainDb: -2,
  },
  'sfx-swipe-resistance-b': {
    module: require('../assets/audio/sfx/swipe-resistance-b.m4a') as number,
    durationMs: 220,
    loop: false,
    gainDb: -2,
  },
  // Complexity ladder: 5-step D Dorian (D E F A B) at octave 5; level 1 = lowest.
  'sfx-complexity-1': {
    module: require('../assets/audio/sfx/complexity-1.m4a') as number,
    durationMs: 600,
    loop: false,
    gainDb: -2,
    level: 1,
  },
  'sfx-complexity-2': {
    module: require('../assets/audio/sfx/complexity-2.m4a') as number,
    durationMs: 600,
    loop: false,
    gainDb: -2,
    level: 2,
  },
  'sfx-complexity-3': {
    module: require('../assets/audio/sfx/complexity-3.m4a') as number,
    durationMs: 600,
    loop: false,
    gainDb: -2,
    level: 3,
  },
  'sfx-complexity-4': {
    module: require('../assets/audio/sfx/complexity-4.m4a') as number,
    durationMs: 600,
    loop: false,
    gainDb: -2,
    level: 4,
  },
  'sfx-complexity-5': {
    module: require('../assets/audio/sfx/complexity-5.m4a') as number,
    durationMs: 600,
    loop: false,
    gainDb: -2,
    level: 5,
  },
  // Laterality ladder: same D Dorian degrees at octave 6; level 1 = lowest.
  'sfx-laterality-snap-1': {
    module: require('../assets/audio/sfx/laterality-snap-1.m4a') as number,
    durationMs: 300,
    loop: false,
    gainDb: 0,
    level: 1,
  },
  'sfx-laterality-snap-2': {
    module: require('../assets/audio/sfx/laterality-snap-2.m4a') as number,
    durationMs: 300,
    loop: false,
    gainDb: 0,
    level: 2,
  },
  'sfx-laterality-snap-3': {
    module: require('../assets/audio/sfx/laterality-snap-3.m4a') as number,
    durationMs: 300,
    loop: false,
    gainDb: 0,
    level: 3,
  },
  'sfx-laterality-snap-4': {
    module: require('../assets/audio/sfx/laterality-snap-4.m4a') as number,
    durationMs: 300,
    loop: false,
    gainDb: 0,
    level: 4,
  },
  'sfx-laterality-snap-5': {
    module: require('../assets/audio/sfx/laterality-snap-5.m4a') as number,
    durationMs: 300,
    loop: false,
    gainDb: 0,
    level: 5,
  },
  'sfx-reshuffle-gather': {
    module: require('../assets/audio/sfx/reshuffle-gather.m4a') as number,
    durationMs: 1118,
    loop: false,
    gainDb: -4,
  },
  'sfx-reshuffle-land-a': {
    module: require('../assets/audio/sfx/reshuffle-land-a.m4a') as number,
    durationMs: 1480,
    loop: false,
    gainDb: -2,
  },
  'sfx-reshuffle-land-b': {
    module: require('../assets/audio/sfx/reshuffle-land-b.m4a') as number,
    durationMs: 1480,
    loop: false,
    gainDb: -2,
  },
  'sfx-reshuffle-land-wide': {
    module: require('../assets/audio/sfx/reshuffle-land-wide.m4a') as number,
    durationMs: 2000,
    loop: false,
    gainDb: -2,
  },
  'sfx-card-arrive-a': {
    module: require('../assets/audio/sfx/card-arrive-a.m4a') as number,
    durationMs: 400,
    loop: false,
    gainDb: -4,
  },
  'sfx-card-arrive-b': {
    module: require('../assets/audio/sfx/card-arrive-b.m4a') as number,
    durationMs: 400,
    loop: false,
    gainDb: -4,
  },
  'sfx-sheet-open': {
    module: require('../assets/audio/sfx/sheet-open.m4a') as number,
    durationMs: 400,
    loop: false,
    gainDb: -2,
  },
  'sfx-sheet-close': {
    module: require('../assets/audio/sfx/sheet-close.m4a') as number,
    durationMs: 389,
    loop: false,
    gainDb: -2,
  },
  'sfx-error-soft-a': {
    module: require('../assets/audio/sfx/error-soft-a.m4a') as number,
    durationMs: 900,
    loop: false,
    gainDb: -2,
  },
  'sfx-error-soft-b': {
    module: require('../assets/audio/sfx/error-soft-b.m4a') as number,
    durationMs: 900,
    loop: false,
    gainDb: -2,
  },
  'sfx-no-match-soft': {
    module: require('../assets/audio/sfx/no-match-soft.m4a') as number,
    durationMs: 900,
    loop: false,
    gainDb: -2,
  },
} as const satisfies Record<SoundAssetName, SoundAssetMeta>;

/** Variant pools — add/replace a file without changing call sites. */
export const SOUND_VARIANT_GROUPS = {
  card_flip: ['sfx-card-flip-a', 'sfx-card-flip-c'] as const satisfies readonly SoundAssetName[],
  card_flip_back: ['sfx-card-flip-back-a', 'sfx-card-flip-back-c'] as const satisfies readonly SoundAssetName[],
  swipe_next: ['sfx-swipe-next-a', 'sfx-swipe-next-b', 'sfx-swipe-next-c'] as const satisfies readonly SoundAssetName[],
  swipe_back: ['sfx-swipe-back-a'] as const satisfies readonly SoundAssetName[],
  swipe_cancel: ['sfx-swipe-cancel-a', 'sfx-swipe-cancel-b'] as const satisfies readonly SoundAssetName[],
  swipe_resistance: ['sfx-swipe-resistance-a', 'sfx-swipe-resistance-b'] as const satisfies readonly SoundAssetName[],
  complexity_changed: ['sfx-complexity-1', 'sfx-complexity-2', 'sfx-complexity-3', 'sfx-complexity-4', 'sfx-complexity-5'] as const satisfies readonly SoundAssetName[],
  laterality_step: ['sfx-laterality-snap-1', 'sfx-laterality-snap-2', 'sfx-laterality-snap-3', 'sfx-laterality-snap-4', 'sfx-laterality-snap-5'] as const satisfies readonly SoundAssetName[],
  reshuffle_started: ['sfx-reshuffle-gather'] as const satisfies readonly SoundAssetName[],
  /** a/b for normal land; wide is picked only when `reshuffle_landed.random` (Random entry). */
  reshuffle_landed: ['sfx-reshuffle-land-a', 'sfx-reshuffle-land-b'] as const satisfies readonly SoundAssetName[],
  reshuffle_landed_wide: ['sfx-reshuffle-land-wide'] as const satisfies readonly SoundAssetName[],
  card_arrived: ['sfx-card-arrive-a', 'sfx-card-arrive-b'] as const satisfies readonly SoundAssetName[],
  sheet_open: ['sfx-sheet-open'] as const satisfies readonly SoundAssetName[],
  sheet_close: ['sfx-sheet-close'] as const satisfies readonly SoundAssetName[],
  error_soft: ['sfx-error-soft-a', 'sfx-error-soft-b'] as const satisfies readonly SoundAssetName[],
  no_match: ['sfx-no-match-soft'] as const satisfies readonly SoundAssetName[],
  intro_started: ['music-intro-loop'] as const satisfies readonly SoundAssetName[],
  intro_ready: ['music-intro-arrival-a', 'music-intro-arrival-b'] as const satisfies readonly SoundAssetName[],
  music_bed: ['music-bed-calm-a', 'music-bed-bright-b'] as const satisfies readonly SoundAssetName[],
  music_texture: ['music-texture-shimmer-a', 'music-texture-subswell-b', 'music-texture-tonedrift-c', 'music-texture-air-d'] as const satisfies readonly SoundAssetName[],
  music_dropin: ['music-dropin-01', 'music-dropin-02', 'music-dropin-03', 'music-dropin-04', 'music-dropin-05', 'music-dropin-06', 'music-dropin-07', 'music-dropin-08', 'music-dropin-09', 'music-dropin-10', 'music-dropin-11', 'music-dropin-12', 'music-dropin-13', 'music-dropin-14', 'music-dropin-15', 'music-dropin-16', 'music-dropin-17', 'music-dropin-18', 'music-dropin-19', 'music-dropin-20', 'music-dropin-21', 'music-dropin-22', 'music-dropin-23', 'music-dropin-24'] as const satisfies readonly SoundAssetName[],
  swipe_tone: ['sfx-swipe-tone-up', 'sfx-swipe-tone-down'] as const satisfies readonly SoundAssetName[],
} as const;

export type SoundVariantGroupName = keyof typeof SOUND_VARIANT_GROUPS;

export function getSoundAsset(name: SoundAssetName): SoundAssetMeta {
  return SOUND_ASSETS[name];
}

/** Duration for Sound 8 AAC loop padding (`loopEnd = durationMs / 1000`). */
export function getSoundAssetDurationMs(name: SoundAssetName): number {
  return SOUND_ASSETS[name].durationMs;
}

/** Resolve authored duration from a `require` module id (Sound 5 RM fade). */
export function getSoundAssetDurationMsForModule(moduleId: number): number | null {
  for (const name of Object.keys(SOUND_ASSETS) as SoundAssetName[]) {
    if (SOUND_ASSETS[name].module === moduleId) {
      return SOUND_ASSETS[name].durationMs;
    }
  }
  return null;
}

export function resolveVariantModules(
  names: readonly SoundAssetName[],
): number[] {
  return names.map((name) => SOUND_ASSETS[name].module);
}
