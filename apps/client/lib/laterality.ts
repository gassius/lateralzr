import {
  lateralityGradientExtras,
  lateralityGradientFront,
  lateralityGradientPaper,
} from '../theme/lateralityGradients';
import { conceptKey, type DeckConcept } from './conceptDeck';

/** Default laterality grade — middle of the 1–5 edge-distance scale. */
export const DEFAULT_LATERALITY = 3;

export const MIN_LATERALITY = 1;
export const MAX_LATERALITY = 5;

export type LateralityGrade = 1 | 2 | 3 | 4 | 5;

export type LateralityGradientStops = {
  start: string;
  mid?: string;
  end: string;
};

export type LateralityTreeSwap = {
  concepts: DeckConcept[];
  currentIndex: number;
};

/**
 * Accept only a whole integer 1–5. Blank, decimals, and out-of-range values are ignored.
 */
export function parseLateralityParam(value: string | null | undefined): LateralityGrade | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!/^[1-5]$/.test(trimmed)) return undefined;
  return Number(trimmed) as LateralityGrade;
}

export function clampLaterality(value: number): LateralityGrade {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return DEFAULT_LATERALITY;
  return Math.min(MAX_LATERALITY, Math.max(MIN_LATERALITY, n)) as LateralityGrade;
}

export function stepLaterality(current: number, delta: -1 | 1): LateralityGrade {
  return clampLaterality(current + delta);
}

export type LateralityPersistReason = 'hydrate' | 'control';

/** URL `?laterality=N` wins for this session/load only. */
export function resolveInitialLaterality(
  urlLaterality: LateralityGrade | undefined,
  stored: LateralityGrade,
): LateralityGrade {
  return urlLaterality ?? stored;
}

/** Persist only after an intentional submenu +/−. Deep-link overrides stay session-only. */
export function shouldPersistLaterality(reason: LateralityPersistReason): boolean {
  return reason === 'control';
}

export type LateralitySwapResult = 'success' | 'failure';

/**
 * Write storage only after a successful neighborhood swap.
 * A failed +/− must not persist the optimistic grade (or overwrite a session `?laterality=`).
 */
export function shouldPersistLateralityAfterSwap(
  reason: LateralityPersistReason,
  result: LateralitySwapResult,
): boolean {
  return result === 'success' && shouldPersistLaterality(reason);
}

/** − / + stay inert while the neighborhood swirl is covering the tree swap. */
export function lateralityControlDisabled(canStep: boolean, swapping: boolean): boolean {
  return swapping || !canStep;
}

/**
 * Calm 2–3 stop wordmark gradient on the shell deck.
 * Low laterality stays cool/contained; high laterality opens toward orange.
 * Stops stay light enough to read on color.shell. Extra hexes restyle in Lz-30.
 */
export function lateralityGradientStops(grade: number): LateralityGradientStops {
  const laterality = clampLaterality(grade);
  switch (laterality) {
    case 1:
      return { start: lateralityGradientExtras.coolGray, end: lateralityGradientExtras.coolMid };
    case 2:
      return {
        start: lateralityGradientExtras.coolGray,
        mid: lateralityGradientExtras.coolBlend,
        end: lateralityGradientExtras.warmBlend,
      };
    case 3:
      return { start: lateralityGradientPaper, end: lateralityGradientFront };
    case 4:
      return {
        start: lateralityGradientExtras.orangeSoft,
        mid: lateralityGradientFront,
        end: lateralityGradientExtras.orangeLight,
      };
    case 5:
      return { start: lateralityGradientFront, end: lateralityGradientPaper };
  }
}

/**
 * Keep the visible card; replace the rest of the deck with the prefetched tree.
 * The current card stays on screen so the swap is not a full reload.
 */
export function applyLateralityTreeSwap(
  existing: DeckConcept[],
  incoming: DeckConcept[],
  currentIndex: number,
): LateralityTreeSwap {
  const current = existing[currentIndex];
  if (!current) {
    return {
      concepts: incoming,
      currentIndex: 0,
    };
  }
  if (incoming.length === 0) {
    return { concepts: existing, currentIndex };
  }

  const currentKey = conceptKey(current.concept);
  const rest = incoming.filter((item) => conceptKey(item.concept) !== currentKey);
  return {
    concepts: [current, ...rest],
    currentIndex: 0,
  };
}
