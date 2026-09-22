/**
 * Card-back composition: media is optional. Description grounds the concept;
 * this module does not encode the lateral bridge to the previous/next card.
 */

export type CardBackMediaPhase = 'absent' | 'loading' | 'ready' | 'failed';

export type CardBackLayoutMode = 'with-media' | 'without-media';

/** How leftover viewport height is used on the back column. */
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

/**
 * How the photo paints inside the expanding well.
 * `contain` letterboxes on the orange face (landscape: tall gutters; portrait: side bars).
 * `cover` centered fills the well; crop is the trade for a finished, media-forward back.
 */
export type CardBackMediaContentFit = 'cover' | 'contain';

export const CARD_BACK_MEDIA_CONTENT_FIT: CardBackMediaContentFit = 'cover';
export const CARD_BACK_MEDIA_CONTENT_POSITION = 'center' as const;

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
  titleFontSize: 40,
  titleLineHeight: 48,
  titleMarginBottom: 26,
  descriptionFontSize: 20,
  descriptionLineHeight: 32,
  descriptionMarginBottom: 18,
  linkMarginTop: 10,
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
  /** Cover-fill the well when media is shown; null when the zone is collapsed. */
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
    showMediaPlaceholder: phase === 'loading',
    showMediaImage: true,
    expandMediaZone: true,
    balanceCopy: false,
    mediaContentFit: CARD_BACK_MEDIA_CONTENT_FIT,
    rhythm: CARD_BACK_WITH_MEDIA_RHYTHM,
  };
}

/** Matches `faceInner` padding so measured face height converts to content minHeight. */
export const CARD_BACK_FACE_PADDING = 20;
export const CARD_BACK_FACE_BORDER = 1;

/**
 * Pixel height for the no-media column / with-media ScrollView content.
 * Percentage height is a no-op inside a transformed (flip) ancestor on web.
 * Subtract padding and border so the column fits the visible orange content box.
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
 * No-media column: explicit pixel height from the untransformed front face.
 * `bottom: 0` / flex leftover do not stretch under the flip transform on RN Web.
 */
export function cardBackBalancedColumnStyle(faceHeight: number): {
  justifyContent: CardBackScrollJustify;
  height?: number;
} {
  const height = cardBackScrollMinHeight(faceHeight);
  return height != null
    ? { height, justifyContent: CARD_BACK_WITHOUT_MEDIA_RHYTHM.scrollJustify }
    : { justifyContent: CARD_BACK_WITHOUT_MEDIA_RHYTHM.scrollJustify };
}
