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

export function reshuffleStatusVisible(elapsedMs: number): boolean {
  return elapsedMs >= reshuffle.statusDelayMs;
}

export function reshuffleCanSettle(elapsedMs: number, fetchDone: boolean): boolean {
  return fetchDone && elapsedMs >= reshuffle.minCueMs;
}

export function reshuffleTimedOut(elapsedMs: number): boolean {
  return elapsedMs >= reshuffle.timeoutMs;
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

export const RESHUFFLE_FAN_DEG = reshuffle.fanDeg;
export const RESHUFFLE_FAN_OFFSET_PX = reshuffle.fanOffsetPx;
export const RESHUFFLE_GATHER_DROP_PX = reshuffle.gatherDropPx;
export const RESHUFFLE_GATHER_SCALE = reshuffle.gatherScale;
export const RESHUFFLE_RIFFLE_EVERY_MS = reshuffle.riffleEveryMs;
export const RESHUFFLE_RIFFLE_MOVE_MS = reshuffle.riffleMoveMs;
export const RESHUFFLE_CARD_INPUT_DURING_SHUFFLE = reshuffle.cardInputDuringShuffle;
