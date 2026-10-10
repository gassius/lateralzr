/**
 * Shared ConceptCard shell geometry (ClickUp Lz-24 / guide §8).
 * One radius, width-dependent padding, and a subdued face shadow for both faces.
 */

import { layout, shadow } from '@/theme/tokens';

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

/** Subdued cast shadow — no dark halo on shell `#082D3D` (Critiquito / `shadow.card`). */
export const CARD_SHADOW = {
  shadowColor: shadow.card.color,
  shadowOffset: {
    width: shadow.card.offsetWidth,
    height: shadow.card.offsetHeight,
  },
  shadowOpacity: shadow.card.opacity,
  shadowRadius: shadow.card.radius,
  elevation: shadow.card.elevation,
} as const;
