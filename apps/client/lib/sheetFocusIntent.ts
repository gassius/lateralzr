/** F7 focus target for sheet open / nested view / Motion close / dismiss. */
export type SheetFocusEvent = 'open' | 'nestedOpen' | 'motionViewClose' | 'dismiss';
export type SheetFocusTarget = 'title' | 'motionRow' | 'invoker';

/** Deterministic F7 mapping — title on open/sub-view, Motion row on Motion close. */
export function resolveSheetFocusIntent(event: SheetFocusEvent): SheetFocusTarget {
  if (event === 'open' || event === 'nestedOpen') return 'title';
  if (event === 'motionViewClose') return 'motionRow';
  return 'invoker';
}
