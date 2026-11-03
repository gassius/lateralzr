#!/usr/bin/env node
/**
 * Native adaptive-layer drift helper (AC 4).
 *
 * expo-audio has no sample-accurate scheduler. The layer group re-aligns every
 * loop (~53.333 s). This script does NOT play audio — it documents how to
 * capture a 10-minute C5 drift log from a development build:
 *
 *   1. Launch a native dev build with Sound + Music on.
 *   2. Set Complexity 5 (all layers audible) and leave Laterality stable.
 *   3. After ≥10 minutes, call in the RN debugger:
 *        __getLayerDriftLogForTests() from lib/sound
 *   4. Paste maxDriftSeconds over the run into the PR body.
 *
 * Audible flamming → raise with the Music and Sound FX Director before
 * inventing a native mixer. Native has no LPF/width — gain + arp swap only.
 *
 * Package sha256 (verified at import):
 *   a9f2407b3328763e712d893b5133932dafa067b53af8ae43b45907cdbb7859b2
 */

const SAMPLE_RATE = 44100;
const DURATION_SAMPLES = 2_352_000;
const BARS = 16;
const loopSeconds = DURATION_SAMPLES / SAMPLE_RATE;
const barSeconds = loopSeconds / BARS;
const loopMs = loopSeconds * 1000;
const tenMinMs = 10 * 60 * 1000;

console.log(
  JSON.stringify(
    {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION_SAMPLES,
      loopSeconds,
      barSeconds,
      loopsIn10Min: Math.floor(tenMinMs / loopMs),
      barsIn10Min: Math.floor(tenMinMs / (barSeconds * 1000)),
      note:
        'Run on device at Complexity 5 for ≥10 min; attach __getLayerDriftLogForTests() to the PR.',
      nativeLimits:
        'LPF and stereo width unavailable in expo-audio — gain + arp/arp-bright swap only.',
    },
    null,
    2,
  ),
);
