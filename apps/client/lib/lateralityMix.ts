/**
 * Sound 9 — laterality-row stagger (director 2026-10-24).
 *
 * t=0: laterality_step (full level)
 * t=+80 ms: sheet_close at −3 dB
 * t=+250 ms (or when sheet_close ends, whichever first): reshuffle gather
 *
 * sheet_close duration is 389 ms → gather at +250 ms wins.
 */

import {
  LATERALITY_GATHER_DELAY_MS,
  LATERALITY_SHEET_CLOSE_ATTENUATION_DB,
  LATERALITY_SHEET_CLOSE_DELAY_MS,
} from '@/lib/soundMap';
import {
  lateralityStepIfChanged,
  reshuffleStartedSoundEvent,
  sheetCloseSoundEvent,
} from '@/lib/otherSfx';
import type { SoundEvent, SoundEventOptions } from '@/lib/soundTypes';

export type LateralityMixPlay = (
  event: SoundEvent,
  options?: SoundEventOptions,
) => void;

export type LateralityRowMixOptions = {
  /** Target laterality grade (1–5). */
  step: number;
  /** Previous grade — when equal, returns a no-op cancel handle. */
  previousStep?: number;
  random: boolean;
  play: LateralityMixPlay;
  /** Shared play options (e.g. reduceMotion). */
  playOptions?: SoundEventOptions;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  /**
   * sheet_close duration ms — gather fires at min(GATHER_DELAY, sheetDelay + duration).
   * Defaults to manifest 389 ms.
   */
  sheetCloseDurationMs?: number;
};

export type LateralityRowMixHandle = {
  cancel: () => void;
  /** Wall-clock ms when gather is scheduled (0 if cancelled / no-op). */
  gatherAtMs: number;
  /** False when step did not change. */
  scheduled: boolean;
};

/**
 * Schedule the three laterality-row sounds. Caller must not also fire
 * immediate `laterality_step` / `reshuffle_started` / dismiss `sheet_close`.
 */
export function scheduleLateralityRowMix(
  options: LateralityRowMixOptions,
): LateralityRowMixHandle {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const sheetDur = options.sheetCloseDurationMs ?? 389;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const noop = (): LateralityRowMixHandle => ({
    cancel: () => {},
    gatherAtMs: 0,
    scheduled: false,
  });

  const previous = options.previousStep;
  const stepEvent =
    previous == null
      ? ({ name: 'laterality_step', step: options.step } as SoundEvent)
      : lateralityStepIfChanged(previous, options.step);
  if (!stepEvent) return noop();

  const playOpts = options.playOptions ?? {};
  options.play(stepEvent, playOpts);

  const sheetAt = LATERALITY_SHEET_CLOSE_DELAY_MS;
  const gatherAt = Math.min(
    LATERALITY_GATHER_DELAY_MS,
    sheetAt + sheetDur,
  );

  timers.push(
    setTimeoutFn(() => {
      options.play(sheetCloseSoundEvent(), {
        ...playOpts,
        gainDbOffset: LATERALITY_SHEET_CLOSE_ATTENUATION_DB,
      });
    }, sheetAt),
  );

  timers.push(
    setTimeoutFn(() => {
      options.play(reshuffleStartedSoundEvent(options.random), playOpts);
    }, gatherAt),
  );

  return {
    scheduled: true,
    gatherAtMs: gatherAt,
    cancel: () => {
      for (const id of timers) clearTimeoutFn(id);
      timers.length = 0;
    },
  };
}
