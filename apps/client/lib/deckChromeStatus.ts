/**
 * Priority resolver for the laterality-row status slot (Lz-35 / Lz-37 / Lz-38).
 * Status never lives on the card and is never a blocking modal.
 */

export type DeckChromeStatus =
  | { kind: 'offline' }
  | { kind: 'noNextIdea' }
  | { kind: 'fetchFailed' }
  | { kind: 'neighbourhoodLoading' }
  | { kind: 'findingStart' }
  | { kind: 'loadingMore' }
  | { kind: 'none' };

export function resolveDeckChromeStatus(args: {
  offline: boolean;
  noNextIdea: boolean;
  loadMoreError: boolean;
  lateralitySwapping: boolean;
  showInitialLoading: boolean;
  showDeckLoading: boolean;
}): DeckChromeStatus {
  if (args.offline) return { kind: 'offline' };
  if (args.noNextIdea) return { kind: 'noNextIdea' };
  if (args.loadMoreError) return { kind: 'fetchFailed' };
  if (args.lateralitySwapping) return { kind: 'neighbourhoodLoading' };
  if (args.showInitialLoading) return { kind: 'findingStart' };
  if (args.showDeckLoading) return { kind: 'loadingMore' };
  return { kind: 'none' };
}
