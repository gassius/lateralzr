import { motion } from '@/theme/tokens';

const reshuffle = motion.reshuffle;

export type LateralityReshufflePhase = 'gather' | 'shuffle' | 'deal' | 'reverse';

export function reshuffleStatusDelayMs(): number {
  return reshuffle.statusDelayMs;
}

export function reshuffleMinCueMs(): number {
  return reshuffle.minCueMs;
}

export function reshuffleTimeoutMs(): number {
  return reshuffle.timeoutMs;
}

export function reshuffleGatherMs(reduceMotion: boolean): number {
  return reduceMotion ? 0 : reshuffle.gatherMs;
}

export function reshuffleDealMs(reduceMotion: boolean): number {
  return reduceMotion ? reshuffle.reducedMotion.crossfadeMs : reshuffle.dealMs;
}

export function reshuffleReverseMs(reduceMotion: boolean): number {
  return reduceMotion ? reshuffle.reducedMotion.crossfadeMs : reshuffle.reverseDealMs;
}

export function reshuffleSilhouetteCount(reduceMotion: boolean): number {
  return reduceMotion ? reshuffle.reducedMotion.silhouettes : reshuffle.silhouettes;
}

/** Stack ↔ cue opacity duration: 150 ms under RM; gather/deal/reverse otherwise. */
export function reshuffleStackFadeMs(
  reduceMotion: boolean,
  phase: LateralityReshufflePhase | null,
): number {
  if (reduceMotion) return reshuffle.reducedMotion.crossfadeMs;
  if (phase === 'deal') return reshuffle.dealMs;
  if (phase === 'reverse') return reshuffle.reverseDealMs;
  return reshuffle.gatherMs;
}

export const RESHUFFLE_FAN_DEG = reshuffle.fanDeg;
export const RESHUFFLE_FAN_OFFSET_PX = reshuffle.fanOffsetPx;
export const RESHUFFLE_GATHER_DROP_PX = reshuffle.gatherDropPx;
export const RESHUFFLE_GATHER_SCALE = reshuffle.gatherScale;
export const RESHUFFLE_RIFFLE_EVERY_MS = reshuffle.riffleEveryMs;
export const RESHUFFLE_RIFFLE_MOVE_MS = reshuffle.riffleMoveMs;
export const RESHUFFLE_CARD_INPUT_DURING_SHUFFLE = reshuffle.cardInputDuringShuffle;

/** 0 = even fan, 1 = odd fan. Ping-pongs on the fractional riffle tick. */
export function riffleFanMix(riffle: number): number {
  'worklet';
  if (!Number.isFinite(riffle)) return 0;
  const phase = ((riffle % 2) + 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

export function riffleFanOffset(index: number, riffle: number): number {
  'worklet';
  const even = (index - 1) * RESHUFFLE_FAN_OFFSET_PX;
  const odd = -even;
  const mix = riffleFanMix(riffle);
  return even + (odd - even) * mix;
}

export function riffleFanDeg(index: number, riffle: number): number {
  'worklet';
  const even = RESHUFFLE_FAN_DEG[index] ?? 0;
  const odd = -even;
  const mix = riffleFanMix(riffle);
  return even + (odd - even) * mix;
}

export function waitMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('reshuffle-timeout')), ms);
      }),
    ]);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
