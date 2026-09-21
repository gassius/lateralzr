import { Palette } from '../constants/Colors';
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

/**
 * Calm 2–3 stop wordmark gradient. Low laterality stays contained (teal);
 * high laterality opens toward the brand orange / off-white.
 */
export function lateralityGradientStops(grade: number): LateralityGradientStops {
  const laterality = clampLaterality(grade);
  switch (laterality) {
    case 1:
      return { start: Palette.darkBlue, end: '#0e4a62' };
    case 2:
      return { start: Palette.darkBlue, mid: '#1a6d8c', end: '#2a7a8f' };
    case 3:
      return { start: Palette.darkBlue, end: Palette.orange };
    case 4:
      return { start: '#1a6d8c', mid: Palette.orange, end: '#f3a24a' };
    case 5:
      return { start: Palette.orange, end: Palette.offWhite };
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
      currentIndex: incoming.length > 0 ? 0 : 0,
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
