/**
 * Card-back composition: media is optional. Description grounds the concept;
 * this module does not encode the lateral bridge to the previous/next card.
 */

export type CardBackMediaPhase = 'absent' | 'loading' | 'ready' | 'failed';

export type CardBackLayoutMode = 'with-media' | 'without-media';

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
    };
  }

  return {
    mode: 'with-media',
    showMediaZone: true,
    showMediaPlaceholder: phase === 'loading',
    showMediaImage: true,
    expandMediaZone: true,
    balanceCopy: false,
  };
}
