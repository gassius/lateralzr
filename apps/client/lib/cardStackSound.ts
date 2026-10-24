/**
 * Card-stack SFX mapping (Sound 4).
 *
 * Call sites pass `soundEvent` into {@link emitCardStackSound}; unit tests inject a mock.
 * Gesture cancel / resistance use the threshold helpers from worklets (`'worklet'`).
 */

import type { SoundEvent, SoundEventOptions } from '@/lib/soundTypes';

/**
 * Min |translation| (px) before spring-back cancel / first-card resistance SFX.
 * Matches pan activation so taps stay silent.
 */
export const SWIPE_CANCEL_SOUND_THRESHOLD_PX = 18;

function clampComplexityLevel(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

/** Left commit → next; right commit → back (existing navigation semantics). */
export function horizontalSwipeSoundEvent(side: 'left' | 'right'): SoundEvent {
  return { name: side === 'left' ? 'swipe_next' : 'swipe_back' };
}

/**
 * Vertical commit → complexity note only (no air sweep).
 * Returns null when the level did not change (boundary swipe) — avoid double/noop emit.
 */
export function verticalSwipeSoundEvent(
  complexityBefore: number,
  complexityAfter: number,
): SoundEvent | null {
  const before = clampComplexityLevel(complexityBefore);
  const after = clampComplexityLevel(complexityAfter);
  if (before === after) return null;
  return { name: 'complexity_changed', level: after };
}

/** Flip to back → `card_flip`; flip to front → `card_flip_back`. */
export function flipSoundEvent(toBack: boolean): SoundEvent {
  return { name: toBack ? 'card_flip' : 'card_flip_back' };
}

/** Spring-back cancel after a short drag (not a tap). */
export function shouldEmitSwipeCancel(translationPx: number): boolean {
  'worklet';
  return Math.abs(translationPx) >= SWIPE_CANCEL_SOUND_THRESHOLD_PX;
}

/** Rightward drag at the first card (start-of-history resistance). */
export function shouldEmitSwipeResistance(
  translationPx: number,
  canGoBack: boolean,
): boolean {
  'worklet';
  return !canGoBack && translationPx > 0 && shouldEmitSwipeCancel(translationPx);
}

/**
 * Announce a card-stack event. Inject `play` (usually `soundEvent` from `lib/sound`).
 * Does not emit during drag — call only from commit / cancel / resistance / flip.
 */
export function emitCardStackSound(
  event: SoundEvent,
  play: (event: SoundEvent, options?: SoundEventOptions) => void,
  options?: SoundEventOptions,
): void {
  play(event, options);
}
