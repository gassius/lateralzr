/**
 * Other SFX mapping (Sound 5) — complexity menu, laterality, reshuffle,
 * card arrive, sheet, error / no-match.
 *
 * Call sites pass `soundEvent` into {@link emitOtherSfx}; unit tests inject a mock.
 * Vertical swipe complexity is owned by Sound 4 (`cardStackSound`) — do not double-emit.
 * Sound 6 discovery music listens on `reshuffle_landed` only (do not start music here).
 * Sound 7 announcement hooks suppress reshuffle while AT speaks status copy.
 */

import type { SoundEvent, SoundEventOptions } from '@/lib/soundTypes';

/** Laterality grade 5 = "Random entry" → wide land asset. */
export const RANDOM_LATERALITY_GRADE = 5;

function clampLadder(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function isRandomLaterality(grade: number): boolean {
  return clampLadder(grade) === RANDOM_LATERALITY_GRADE;
}

/** Menu / picker complexity — only when the level actually changes. */
export function complexityChangedIfChanged(
  previous: number,
  next: number,
): SoundEvent | null {
  const from = clampLadder(previous);
  const to = clampLadder(next);
  if (from === to) return null;
  return { name: 'complexity_changed', level: to };
}

/** Laterality rail / sheet step — only when the grade actually changes. */
export function lateralityStepIfChanged(
  previous: number,
  next: number,
): SoundEvent | null {
  const from = clampLadder(previous);
  const to = clampLadder(next);
  if (from === to) return null;
  return { name: 'laterality_step', step: to };
}

/** Gather phase — rings once; do not re-trigger on shuffle / long loads. */
export function reshuffleStartedSoundEvent(random: boolean): SoundEvent {
  return { name: 'reshuffle_started', random };
}

/**
 * Deal / land — `random: true` selects the wide land asset in the engine.
 * Sound 6 discovery moment coordinates on this event only.
 */
export function reshuffleLandedSoundEvent(random: boolean): SoundEvent {
  return { name: 'reshuffle_landed', random };
}

/**
 * Card appear outside a forward swipe: first load, after reshuffle land,
 * after error recovery. Never on swipe_next commits.
 */
export function cardArrivedSoundEvent(): SoundEvent {
  return { name: 'card_arrived' };
}

export function sheetOpenSoundEvent(): SoundEvent {
  return { name: 'sheet_open' };
}

export function sheetCloseSoundEvent(): SoundEvent {
  return { name: 'sheet_close' };
}

export function errorSoftSoundEvent(): SoundEvent {
  return { name: 'error_soft' };
}

export function noMatchSoundEvent(): SoundEvent {
  return { name: 'no_match' };
}

export function emitOtherSfx(
  event: SoundEvent,
  play: (event: SoundEvent, options?: SoundEventOptions) => void,
  options?: SoundEventOptions,
): void {
  play(event, options);
}
