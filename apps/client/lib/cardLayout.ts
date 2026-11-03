/**
 * Shared ConceptCard shell geometry (ClickUp Lz-24 / Lz-55 / Lz-67 / guide §8, §16.2).
 * One radius, width-dependent padding, a subdued face shadow, and the native
 * card aspect helper (1.30–1.50, 1.40 preferred; never squash).
 * v3.5: surplus splits into two equal gaps above and below the card.
 */

import { cardAspect, layout, shadow } from '@/theme/tokens';
import {
  COMPLEXITY_CONTROL_HEIGHT,
  resolveEqualCardGaps,
} from './lateralityChrome';
import { practiceHeaderToComplexityOffset } from './practiceLayout';

/** Devices at or below this width use `layout.cardPaddingNarrow`. */
export const CARD_PADDING_NARROW_MAX_WIDTH = 360;

/** Corner radius on every card face / behind tint (token). */
export function cardRadius(): number {
  return layout.cardRadius;
}

/**
 * Face padding for the given viewport (or phone-frame) width.
 * ≤360 → 20; above → 24.
 */
export function cardPadding(width: number): number {
  const w = Number.isFinite(width) ? width : 0;
  return w <= CARD_PADDING_NARROW_MAX_WIDTH
    ? layout.cardPaddingNarrow
    : layout.cardPadding;
}

/**
 * Fallback face width before the first onLayout (letterboxed preview content
 * ~301 + 20 px padding each side). Used for title measure + pattern scaling.
 */
export const CARD_FACE_FALLBACK_WIDTH = 341;

export type CardShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
  boxShadow?: string;
};

const CARD_SHADOW_BASE = {
  shadowColor: shadow.card.color,
  shadowOffset: {
    width: shadow.card.offsetWidth,
    height: shadow.card.offsetHeight,
  },
  shadowOpacity: shadow.card.opacity,
  shadowRadius: shadow.card.radius,
} as const;

/**
 * Soft token shadow. Android `elevation` is a hard Material blob — drop it
 * and approximate `shadow.card` with RN `boxShadow` (New Arch).
 * Do not import `Platform` here (unit tests run under tsx).
 */
export function cardShadowStyle(os: 'ios' | 'android' | 'web' | 'windows' | 'macos'): CardShadowStyle {
  if (os === 'android') {
    return {
      ...CARD_SHADOW_BASE,
      elevation: 0,
      boxShadow: `0px ${shadow.card.offsetHeight}px ${shadow.card.radius}px rgba(0,0,0,${shadow.card.opacity})`,
    };
  }
  return {
    ...CARD_SHADOW_BASE,
    elevation: shadow.card.elevation,
  };
}

/** iOS / web shadow. Native Android uses {@link cardShadowStyle}('android'). */
export const CARD_SHADOW = cardShadowStyle('ios');

/**
 * Horizontal inset each side of the card inside the practice column (guide §8
 * / §9.7 card-stack gutter). Token `layout.cardStackGutter`.
 */
export const CARD_STACK_GUTTER = layout.cardStackGutter;

export type NativeCardLayout = {
  width: number;
  height: number;
  /** Equal gap above the card (Complexity rail → card). */
  topSurplus: number;
  /** Equal gap below the card (card → Laterality label); holds messaging. */
  bottomSurplus: number;
  padding: number;
  narrowed: boolean;
  aspect: number;
};

const emptyCardLayout = (): NativeCardLayout => ({
  width: 0,
  height: 0,
  topSurplus: 0,
  bottomSurplus: 0,
  padding: layout.cardPaddingNarrow,
  narrowed: false,
  aspect: 0,
});

/**
 * Vertical budget for (equal gaps + card height).
 * Available = screen − insets − (wordmark bottom + 24 → Complexity) − Complexity
 * bar − Laterality label/rail − extras. Messaging overlays in the lower gap.
 */
export function cardVerticalBudget(input: {
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  /** Offset from content top to Complexity label (wordmark bottom + 24). */
  headerToComplexityOffset: number;
  complexityBarHeight: number;
  lateralityLabelAndRailHeight: number;
  extraBelowCard?: number;
}): number {
  const extra = input.extraBelowCard ?? 0;
  const values = [
    input.screenHeight,
    input.insetTop,
    input.insetBottom,
    input.headerToComplexityOffset,
    input.complexityBarHeight,
    input.lateralityLabelAndRailHeight,
    extra,
  ];
  if (values.some((n) => !Number.isFinite(n))) return 0;
  return Math.max(
    0,
    input.screenHeight -
      input.insetTop -
      input.insetBottom -
      input.headerToComplexityOffset -
      input.complexityBarHeight -
      input.lateralityLabelAndRailHeight -
      extra,
  );
}

/**
 * v3.5 §16.2: card height is available height clamped to 1.30–1.50 × width,
 * with 1.40 preferred when it fits. Surplus splits into two equal gaps
 * (above + below) by default. Pass `surplusMode: 'above'` when the caller
 * already reserved the lower gap (ConceptCardStack paddingTop only).
 * If 1.30 does not fit, narrow (centred, ≥ 288) rather than squash.
 */
export function resolveCardAspectLayout(input: {
  columnWidth: number;
  availableHeight: number;
  gutter?: number;
  /** `equal` (default) splits leftover; `above` puts all leftover in topSurplus. */
  surplusMode?: 'equal' | 'above';
}): NativeCardLayout {
  const gutter = input.gutter ?? CARD_STACK_GUTTER;
  const surplusMode = input.surplusMode ?? 'equal';
  const column = Number.isFinite(input.columnWidth) ? Math.max(0, input.columnWidth) : 0;
  const available = Number.isFinite(input.availableHeight)
    ? Math.max(0, input.availableHeight)
    : 0;
  const fullWidth = Math.max(0, column - gutter * 2);
  if (fullWidth <= 0) return emptyCardLayout();

  const minR = cardAspect.min;
  const prefR = cardAspect.preferred;
  const maxR = cardAspect.max;
  const minW = cardAspect.minCardWidth;

  let width = fullWidth;
  let narrowed = false;

  const preferredAtFull = fullWidth * prefR;
  const minAtFull = fullWidth * minR;

  let height: number;
  if (available >= preferredAtFull) {
    height = preferredAtFull;
  } else if (available >= minAtFull) {
    height = available;
  } else {
    narrowed = true;
    const widthToFitMin = available > 0 ? available / minR : minW;
    width = Math.min(fullWidth, Math.max(minW, widthToFitMin));
    const preferred = width * prefR;
    const minHeight = width * minR;
    if (available >= preferred) {
      height = preferred;
    } else if (available >= minHeight) {
      height = available;
    } else {
      height = minHeight;
    }
  }

  const absMin = width * minR;
  const absMax = width * maxR;
  if (height > absMax) height = absMax;
  if (height < absMin) height = absMin;

  const leftover = Math.max(0, available - height);
  let above: number;
  let below: number;
  if (surplusMode === 'above') {
    above = leftover;
    below = 0;
  } else {
    ({ above, below } = resolveEqualCardGaps(leftover));
  }
  const aspect = width > 0 ? height / width : 0;
  // §16.2: drop to cardPaddingNarrow only at min width when 1.30 still
  // does not fit. Any earlier narrowing keeps the width-based padding.
  const minDidNotFit = available < width * minR;
  const padding =
    narrowed && width === minW && minDidNotFit
      ? layout.cardPaddingNarrow
      : cardPadding(width);

  return {
    width,
    height,
    topSurplus: above,
    bottomSurplus: below,
    padding,
    narrowed,
    aspect,
  };
}

/** Compose §16.2 from screen metrics (insets, header, Complexity, Laterality). */
export function resolveNativeCardLayout(input: {
  columnWidth: number;
  screenHeight: number;
  insetTop: number;
  insetBottom: number;
  headerToComplexityOffset?: number;
  complexityBarHeight?: number;
  lateralityLabelAndRailHeight: number;
  extraBelowCard?: number;
  gutter?: number;
}): NativeCardLayout {
  const budget = cardVerticalBudget({
    screenHeight: input.screenHeight,
    insetTop: input.insetTop,
    insetBottom: input.insetBottom,
    headerToComplexityOffset:
      input.headerToComplexityOffset ?? practiceHeaderToComplexityOffset(),
    complexityBarHeight: input.complexityBarHeight ?? COMPLEXITY_CONTROL_HEIGHT,
    lateralityLabelAndRailHeight: input.lateralityLabelAndRailHeight,
    extraBelowCard: input.extraBelowCard,
  });
  return resolveCardAspectLayout({
    columnWidth: input.columnWidth,
    availableHeight: budget,
    gutter: input.gutter,
  });
}
