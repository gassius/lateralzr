import {
  lateralityGradientExtras,
  lateralityGradientFront,
  lateralityGradientPaper,
} from '../theme/lateralityGradients';
import { conceptKey, type DeckConcept } from './conceptDeck';
import { t, type MessageKey } from './i18n';

/** Default laterality grade — middle of the 1–5 edge-distance scale. */
export const DEFAULT_LATERALITY = 3;

export const MIN_LATERALITY = 1;
export const MAX_LATERALITY = 5;

export type LateralityGrade = 1 | 2 | 3 | 4 | 5;

/** i18n keys for the five grade labels (Lz-43 / guide §12.1). */
export const LATERALITY_LABEL_KEYS: Record<LateralityGrade, MessageKey> = {
  1: 'lateralityGrade1',
  2: 'lateralityGrade2',
  3: 'lateralityGrade3',
  4: 'lateralityGrade4',
  5: 'lateralityGrade5',
};

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
 * Map a horizontal position inside a rail of `width` onto the nearest of 5 grades.
 * Used by tap + pan scrub on the laterality control.
 */
export function lateralityStepFromX(x: number, width: number): LateralityGrade {
  if (!(width > 0) || !Number.isFinite(x)) return DEFAULT_LATERALITY;
  const clamped = Math.min(Math.max(x, 0), width);
  const index = Math.min(MAX_LATERALITY - 1, Math.floor((clamped / width) * MAX_LATERALITY));
  return (index + 1) as LateralityGrade;
}

export type LateralityControlGate = {
  /** True while a neighborhood swap is in flight — control commits are inert. */
  swapping?: boolean;
};

/**
 * Grade to commit from a rail tap/pan x. Null when disabled (swap in flight).
 */
export function lateralityCommitFromRail(
  x: number,
  width: number,
  gate: LateralityControlGate = {},
): LateralityGrade | null {
  if (gate.swapping) return null;
  return lateralityStepFromX(x, width);
}

/**
 * Next grade from an a11y action name or web key. Null when unrecognized,
 * disabled (swap in flight), or the step would not change the grade (clamps).
 */
export function lateralityNextFromControlInput(
  grade: number,
  actionOrKey: string,
  gate: LateralityControlGate = {},
): LateralityGrade | null {
  if (gate.swapping) return null;
  const current = clampLaterality(grade);
  let delta: -1 | 1 | null = null;
  if (
    actionOrKey === 'increment' ||
    actionOrKey === 'ArrowRight' ||
    actionOrKey === 'ArrowUp'
  ) {
    delta = 1;
  } else if (
    actionOrKey === 'decrement' ||
    actionOrKey === 'ArrowLeft' ||
    actionOrKey === 'ArrowDown'
  ) {
    delta = -1;
  }
  if (delta == null) return null;
  const next = stepLaterality(current, delta);
  return next === current ? null : next;
}

export function lateralityGradeLabelKey(grade: number): MessageKey {
  return LATERALITY_LABEL_KEYS[clampLaterality(grade)];
}

/** Accessible value text: "Provocation, 4 of 5" / "Provocación, 4 de 5". */
export function lateralityA11yText(grade: number): string {
  const n = clampLaterality(grade);
  const label = t(LATERALITY_LABEL_KEYS[n]);
  return t('lateralityA11yValue', { label, n: String(n) });
}

export type LateralityPersistReason = 'hydrate' | 'control';

/** URL `?laterality=N` wins for this session/load only. */
export function resolveInitialLaterality(
  urlLaterality: LateralityGrade | undefined,
  stored: LateralityGrade,
): LateralityGrade {
  return urlLaterality ?? stored;
}

/** Persist only after an intentional control change. Deep-link overrides stay session-only. */
export function shouldPersistLaterality(reason: LateralityPersistReason): boolean {
  return reason === 'control';
}

export type LateralitySwapResult = 'success' | 'failure';

/**
 * Write storage only after a successful neighborhood swap.
 * A failed change must not persist the optimistic grade (or overwrite a session `?laterality=`).
 */
export function shouldPersistLateralityAfterSwap(
  reason: LateralityPersistReason,
  result: LateralitySwapResult,
): boolean {
  return result === 'success' && shouldPersistLaterality(reason);
}

/** Control stays inert while the neighborhood swap is covering the tree swap. */
export function lateralityControlDisabled(canStep: boolean, swapping: boolean): boolean {
  return swapping || !canStep;
}

/**
 * Calm 2–3 stop gradient for the laterality swirl overlay (Lz-33 removes swirl).
 * Low laterality stays cool/contained; high laterality opens toward orange.
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
