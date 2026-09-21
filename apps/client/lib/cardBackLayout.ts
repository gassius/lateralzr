/**
 * Card-back composition: media is optional. Description grounds the concept;
 * this module does not encode the lateral bridge to the previous/next card.
 */

export type CardBackMediaPhase = 'absent' | 'loading' | 'ready' | 'failed';

export type CardBackLayoutMode = 'with-media' | 'without-media';

/** How leftover viewport height is used on the back ScrollView. */
export type CardBackScrollJustify = 'flex-start' | 'center';

/**
 * Typography and placement for the title / description / link cluster.
 * No-media uses a more open rhythm so the copy group can sit as a finished block
 * instead of a tight header over unused orange.
 */
export type CardBackCopyRhythm = {
  scrollJustify: CardBackScrollJustify;
  titleFontSize: number;
  titleLineHeight: number;
  titleMarginBottom: number;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  descriptionMarginBottom: number;
  linkMarginTop: number;
};

export const CARD_BACK_WITH_MEDIA_RHYTHM: CardBackCopyRhythm = {
  scrollJustify: 'flex-start',
  titleFontSize: 26,
  titleLineHeight: 32,
  titleMarginBottom: 8,
  descriptionFontSize: 16,
  descriptionLineHeight: 24,
  descriptionMarginBottom: 12,
  linkMarginTop: 0,
};

export const CARD_BACK_WITHOUT_MEDIA_RHYTHM: CardBackCopyRhythm = {
  scrollJustify: 'center',
  titleFontSize: 34,
  titleLineHeight: 42,
  titleMarginBottom: 20,
  descriptionFontSize: 18,
  descriptionLineHeight: 28,
  descriptionMarginBottom: 18,
  linkMarginTop: 6,
};

export type CardBackLayout = {
  mode: CardBackLayoutMode;
  /** Mount the media well only while loading or ready. Collapse it when empty or failed. */
  showMediaZone: boolean;
  showMediaPlaceholder: boolean;
  showMediaImage: boolean;
  /** Let the media well take leftover height so the back is not an unused void. */
  expandMediaZone: boolean;
  /** Vertically balance title + description + links when there is no media well. */
  balanceCopy: boolean;
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
      rhythm: CARD_BACK_WITHOUT_MEDIA_RHYTHM,
    };
  }

  return {
    mode: 'with-media',
    showMediaZone: true,
    showMediaPlaceholder: phase === 'loading',
    showMediaImage: true,
    expandMediaZone: true,
    balanceCopy: false,
    rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
  };
}

/** Matches `faceInner` padding so measured face height converts to content minHeight. */
export const CARD_BACK_FACE_PADDING = 20;

/**
 * Pixel minHeight for ScrollView content so flex/justify actually receive leftover
 * space. Percentage minHeight is a no-op inside a transformed (flip) ancestor on web.
 */
export function cardBackScrollMinHeight(
  faceHeight: number,
  padding: number = CARD_BACK_FACE_PADDING,
): number | undefined {
  const inner = faceHeight - padding * 2;
  if (!Number.isFinite(inner) || inner <= 0) return undefined;
  return inner;
}
