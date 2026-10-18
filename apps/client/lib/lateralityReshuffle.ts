import { motion } from '@/theme/tokens';

const reshuffle = motion.reshuffle;

export type LateralityReshufflePhase = 'gather' | 'shuffle' | 'deal' | 'reverse';

export type ReshuffleCueFrame = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type ReshufflePhaseTargets = {
  gather: number;
  deal: number;
  reverse: number;
  cardOpacity: number;
  cueOpacity: number;
  gatherMs: number;
  dealMs: number;
  reverseMs: number;
  cardOpacityMs: number;
  cueOpacityMs: number;
};

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

/**
 * Card opacity duration. Full-motion gather keeps the card visible (0);
 * shuffle crossfades it away; deal/reverse fade it in over the settle.
 */
export function reshuffleStackFadeMs(
  reduceMotion: boolean,
  phase: LateralityReshufflePhase | null,
): number {
  if (reduceMotion) return reshuffle.reducedMotion.crossfadeMs;
  if (phase === 'deal') return reshuffle.dealMs;
  if (phase === 'reverse') return reshuffle.reverseDealMs;
  if (phase === 'shuffle') return reshuffle.reducedMotion.crossfadeMs;
  return 0;
}

export const RESHUFFLE_FAN_DEG = reshuffle.fanDeg;
export const RESHUFFLE_FAN_OFFSET_PX = reshuffle.fanOffsetPx;
export const RESHUFFLE_GATHER_DROP_PX = reshuffle.gatherDropPx;
export const RESHUFFLE_GATHER_SCALE = reshuffle.gatherScale;
export const RESHUFFLE_RIFFLE_EVERY_MS = reshuffle.riffleEveryMs;
export const RESHUFFLE_RIFFLE_MOVE_MS = reshuffle.riffleMoveMs;
export const RESHUFFLE_CARD_INPUT_DURING_SHUFFLE = reshuffle.cardInputDuringShuffle;

/** Cue sits on the card rect (bottom-aligned inside the stack slot). */
export function reshuffleCueFrame(
  layout: { topSurplus: number; width: number; height: number },
  columnWidth: number,
): ReshuffleCueFrame {
  const width = Math.max(0, layout.width);
  return {
    top: Math.max(0, layout.topSurplus),
    left: Math.max(0, (columnWidth - width) / 2),
    width,
    height: Math.max(0, layout.height),
  };
}

/** Shared gather / deal / reverse endpoints for the card and the cue. */
export function reshufflePhaseTargets(
  phase: LateralityReshufflePhase | null,
  reduceMotion: boolean,
): ReshufflePhaseTargets {
  const gatherMs = reshuffleGatherMs(reduceMotion);
  const dealMs = reshuffleDealMs(reduceMotion);
  const reverseMs = reshuffleReverseMs(reduceMotion);
  const fadeMs = reshuffle.reducedMotion.crossfadeMs;

  if (reduceMotion) {
    const showingCard = phase == null || phase === 'deal' || phase === 'reverse';
    return {
      gather: 0,
      deal: 0,
      reverse: 0,
      cardOpacity: showingCard ? 1 : 0,
      cueOpacity: showingCard ? 0 : 1,
      gatherMs: 0,
      dealMs,
      reverseMs,
      cardOpacityMs: fadeMs,
      cueOpacityMs: fadeMs,
    };
  }

  if (phase === 'gather') {
    return {
      gather: 1,
      deal: 0,
      reverse: 0,
      cardOpacity: 1,
      cueOpacity: 1,
      gatherMs,
      dealMs: 0,
      reverseMs: 0,
      cardOpacityMs: 0,
      cueOpacityMs: 0,
    };
  }
  if (phase === 'shuffle') {
    return {
      gather: 1,
      deal: 0,
      reverse: 0,
      cardOpacity: 0,
      cueOpacity: 1,
      gatherMs: 0,
      dealMs: 0,
      reverseMs: 0,
      cardOpacityMs: fadeMs,
      cueOpacityMs: 0,
    };
  }
  if (phase === 'deal') {
    return {
      gather: 1,
      deal: 1,
      reverse: 0,
      cardOpacity: 1,
      cueOpacity: 0,
      gatherMs: 0,
      dealMs,
      reverseMs: 0,
      cardOpacityMs: dealMs,
      cueOpacityMs: dealMs,
    };
  }
  if (phase === 'reverse') {
    return {
      gather: 1,
      deal: 0,
      reverse: 1,
      cardOpacity: 1,
      cueOpacity: 0,
      gatherMs: 0,
      dealMs: 0,
      reverseMs,
      cardOpacityMs: reverseMs,
      cueOpacityMs: reverseMs,
    };
  }
  return {
    gather: 0,
    deal: 0,
    reverse: 0,
    cardOpacity: 1,
    cueOpacity: 0,
    gatherMs: 0,
    dealMs: 0,
    reverseMs: 0,
    cardOpacityMs: 0,
    cueOpacityMs: 0,
  };
}

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

/** Swap stacking order at the midpoint of each 280 ms riffle move. */
export function riffleStackZ(index: number, count: number, riffle: number): number {
  'worklet';
  const mix = riffleFanMix(riffle);
  const evenZ = count - index;
  const oddZ = index + 1;
  return mix < 0.5 ? evenZ : oddZ;
}

export function reshuffleCardOffsetY(gather: number, deal: number, reverse: number): number {
  'worklet';
  const lift = Math.max(deal, reverse);
  return RESHUFFLE_GATHER_DROP_PX * gather * (1 - lift);
}

export function reshuffleCardScale(gather: number, deal: number, reverse: number): number {
  'worklet';
  const lift = Math.max(deal, reverse);
  return 1 - (1 - RESHUFFLE_GATHER_SCALE) * gather * (1 - lift);
}

export function reshuffleSilhouetteOffsetY(gather: number, deal: number, reverse: number): number {
  'worklet';
  return RESHUFFLE_GATHER_DROP_PX * (gather + deal + reverse);
}

export function reshuffleSilhouetteScale(gather: number): number {
  'worklet';
  return 1 - (1 - RESHUFFLE_GATHER_SCALE) * gather;
}

export function reshuffleSilhouetteOpacity(
  index: number,
  gather: number,
  deal: number,
  reverse: number,
): number {
  'worklet';
  const settle = Math.max(0, 1 - deal - reverse);
  const appear = index === 0 ? (gather >= 1 ? 1 : 0) : gather;
  return appear * settle;
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
