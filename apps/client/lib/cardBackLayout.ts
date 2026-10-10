/**
 * Card-back composition: media is optional. Description grounds the concept;
 * this module does not encode the lateral bridge to the previous/next card.
 *
 * Lz-27 (no-media / failed): paper reading region, no title, ScrollView with
 * centered short copy. Lz-28 owns the full-bleed media layer + fade
 * (`lib/cardBackMedia.ts`); this module only toggles the with-media branch.
 */

import { type as typeTokens } from '@/theme/tokens';

export type CardBackMediaPhase = 'absent' | 'loading' | 'ready' | 'failed';

export type CardBackLayoutMode = 'with-media' | 'without-media';

/** How leftover viewport height is used on the back column. */
export type CardBackScrollJustify = 'flex-start' | 'center';

/**
 * Typography and placement for the description / link cluster.
 * No visible back title — the face starts with body copy (guide §9.4).
 */
export type CardBackCopyRhythm = {
  scrollJustify: CardBackScrollJustify;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  /** Kept at 0; link spacing is `linkMarginTop` only so a missing wikiUrl leaves no gap. */
  descriptionMarginBottom: number;
  /** 20–24 px below the paragraph when a wiki link is shown. */
  linkMarginTop: number;
};

/**
 * Default paint mode for adequate photos (Lz-28). Runtime fit may switch to
 * `contain` via `resolveCardBackMediaFit` (png/svg or >1.5× upscale).
 */
export type CardBackMediaContentFit = 'cover' | 'contain';

export const CARD_BACK_MEDIA_CONTENT_FIT: CardBackMediaContentFit = 'cover';
export const CARD_BACK_MEDIA_CONTENT_POSITION = 'center' as const;

/** Midpoint of the guide’s 20–24 px link offset under the paragraph. */
export const CARD_BACK_LINK_MARGIN_TOP = 22;

const BODY_SIZE = typeTokens.body;
const BODY_LINE_HEIGHT = Math.round(BODY_SIZE * 1.5);

export const CARD_BACK_WITH_MEDIA_RHYTHM: CardBackCopyRhythm = {
  scrollJustify: 'flex-start',
  descriptionFontSize: BODY_SIZE,
  descriptionLineHeight: BODY_LINE_HEIGHT,
  descriptionMarginBottom: 0,
  linkMarginTop: CARD_BACK_LINK_MARGIN_TOP,
};

export const CARD_BACK_WITHOUT_MEDIA_RHYTHM: CardBackCopyRhythm = {
  scrollJustify: 'center',
  descriptionFontSize: BODY_SIZE,
  descriptionLineHeight: BODY_LINE_HEIGHT,
  descriptionMarginBottom: 0,
  linkMarginTop: CARD_BACK_LINK_MARGIN_TOP,
};

export type CardBackLayout = {
  mode: CardBackLayoutMode;
  /** Mount the media layer while loading or ready. Collapse it when empty or failed. */
  showMediaZone: boolean;
  /**
   * Legacy flag — always false. Lz-28 has no tinted placeholder; the band is paper
   * until the image decodes.
   */
  showMediaPlaceholder: boolean;
  showMediaImage: boolean;
  /** With-media reading rhythm is top-stacked (image band claims leftover height). */
  expandMediaZone: boolean;
  /**
   * Center the reading region in the ScrollView when there is no media layer
   * (short copy sits mid-face; long copy grows upward and scrolls).
   */
  balanceCopy: boolean;
  /**
   * Default fit hint (`cover`) when the media layer is shown; null when collapsed.
   * Actual fit comes from `resolveCardBackMediaFit`.
   */
  mediaContentFit: CardBackMediaContentFit | null;
  rhythm: CardBackCopyRhythm;
};

export function resolveCardBackMediaPhase(input: {
  hasMediaUrl: boolean;
  decoded: boolean;
  failed: boolean;
}): CardBackMediaPhase {
  if (!input.hasMediaUrl) return 'absent';
  if (input.failed) return 'failed';
  if (!input.decoded) return 'loading';
  return 'ready';
}

export function composeCardBackLayout(phase: CardBackMediaPhase): CardBackLayout {
  if (phase === 'absent' || phase === 'failed') {
    return {
      mode: 'without-media',
      showMediaZone: false,
      showMediaPlaceholder: false,
      showMediaImage: false,
      expandMediaZone: false,
      balanceCopy: true,
      mediaContentFit: null,
      rhythm: CARD_BACK_WITHOUT_MEDIA_RHYTHM,
    };
  }

  return {
    mode: 'with-media',
    showMediaZone: true,
    showMediaPlaceholder: false,
    showMediaImage: phase === 'ready',
    expandMediaZone: true,
    balanceCopy: false,
    mediaContentFit: CARD_BACK_MEDIA_CONTENT_FIT,
    rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
  };
}

/**
 * Default face padding when the caller has not measured viewport width yet.
 * Prefer `cardPadding(width)` from `cardLayout` (20 ≤360 / 24 above).
 */
export const CARD_BACK_FACE_PADDING = 20;

/** Face border removed in Lz-24 (v2 teal hairline); kept as 0 for minHeight math. */
export const CARD_BACK_FACE_BORDER = 0;

/**
 * Pixel height for ScrollView content under the flip transform.
 * Percentage height is a no-op inside a transformed ancestor on web.
 * Subtract padding and border so the column fits the visible paper content box.
 */
export function cardBackScrollMinHeight(
  faceHeight: number,
  padding: number = CARD_BACK_FACE_PADDING,
  border: number = CARD_BACK_FACE_BORDER,
): number | undefined {
  const inner = faceHeight - padding * 2 - border * 2;
  if (!Number.isFinite(inner) || inner <= 0) return undefined;
  return inner;
}

/**
 * ScrollView `contentContainerStyle` for the back face.
 * Measured minHeight comes from the untransformed front (flip collapses layout on RN Web).
 */
export function cardBackScrollContentStyle(
  faceHeight: number,
  padding: number = CARD_BACK_FACE_PADDING,
  justify: CardBackScrollJustify = CARD_BACK_WITHOUT_MEDIA_RHYTHM.scrollJustify,
): {
  flexGrow: 1;
  justifyContent: CardBackScrollJustify;
  minHeight?: number;
} {
  const minHeight = cardBackScrollMinHeight(faceHeight, padding);
  return minHeight != null
    ? { flexGrow: 1, minHeight, justifyContent: justify }
    : { flexGrow: 1, justifyContent: justify };
}
