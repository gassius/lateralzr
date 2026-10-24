# Lateralzr audio kit v1

Audio index for `apps/client/assets/audio/`. Machine-readable list: `apps/client/assets/audio/manifest.json`.
68 sounds, two files each: `<name>.m4a` (native, AAC 44.1 kHz; music stereo 128 kbps, sfx mono 96 kbps) and `<name>.web.m4a` (web preview; music stereo 64 kbps, sfx mono 64 kbps).
Sizes: native set 5.55 MiB, web set 2.90 MiB (budget caps: 8 MiB native / 3 MiB web).

Durations measured with ffprobe on the native file. Loudness measured on the native file with ffmpeg ebur128 (true peak) and volumedetect (sample peak). LUFS is omitted for sfx shorter than 0.4 s (below the gating window). AAC can overshoot the source peak by up to about 2 dB on a few short sfx (swipe-next-b, complexity-5, reshuffle-land-a); all files stay below -1 dBTP.

## Index

| Path | Type | Duration (s) | Loop | Loudness (measured) | Trigger and usage | Variants | Source / notes |
|---|---|---|---|---|---|---|---|
| `music/bed-calm-a.m4a` (+ `.web.m4a`) | music bed | 45.000 | yes | -26.0 LUFS / -13.4 dBTP | Always one bed playing after the intro; low Laterality steps | bed-bright-b | full-kit draft1 loop |
| `music/bed-bright-b.m4a` (+ `.web.m4a`) | music bed | 45.000 | yes | -26.0 LUFS / -13.0 dBTP | Crossfades in for higher Laterality steps (for example Random entry) | bed-calm-a | draft1 loop |
| `music/texture-shimmer-a.m4a` (+ `.web.m4a`) | texture | 23.000 | yes | -26.0 LUFS / -11.7 dBTP | Fades in as Complexity rises | - | draft2 loop |
| `music/texture-subswell-b.m4a` (+ `.web.m4a`) | texture | 29.000 | yes | -26.0 LUFS / -15.7 dBTP | Fades in as Complexity rises | - | draft2 loop |
| `music/texture-tonedrift-c.m4a` (+ `.web.m4a`) | texture (placeholder) | 37.000 | yes | -26.0 LUFS / -11.7 dBTP | Fades in as Complexity rises | - | draft1 loop — PLACEHOLDER, to be replaced |
| `music/texture-air-d.m4a` (+ `.web.m4a`) | texture | 41.000 | yes | -26.0 LUFS / -14.0 dBTP | Fades in at the highest Complexity | - | draft2 loop |
| `music/intro-loop.m4a` (+ `.web.m4a`) | intro | 6.000 | yes | -26.0 LUFS / -16.4 dBTP | Starts with the intro screen; repeats until the app is ready | - | draft3 loop (pitch-corrected +28 c) |
| `music/intro-arrival-a.m4a` (+ `.web.m4a`) | arrival | 1.500 | no | -26.0 LUFS / -17.1 dBTP | When the intro hands off to the first card | intro-arrival-b | draft3 |
| `music/intro-arrival-b.m4a` (+ `.web.m4a`) | arrival | 1.500 | no | -26.1 LUFS / -16.4 dBTP | When the intro hands off to the first card | intro-arrival-a | draft2 |
| `music/dropin-01.m4a` (+ `.web.m4a`) | drop-in | 4.300 | no | -26.0 LUFS / -16.0 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 1 |
| `music/dropin-02.m4a` (+ `.web.m4a`) | drop-in | 4.600 | no | -26.1 LUFS / -17.3 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 2 |
| `music/dropin-03.m4a` (+ `.web.m4a`) | drop-in | 4.700 | no | -26.0 LUFS / -17.3 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 3 |
| `music/dropin-04.m4a` (+ `.web.m4a`) | drop-in | 5.700 | no | -26.0 LUFS / -14.3 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 4 |
| `music/dropin-05.m4a` (+ `.web.m4a`) | drop-in | 7.200 | no | -26.0 LUFS / -16.5 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 5 |
| `music/dropin-06.m4a` (+ `.web.m4a`) | drop-in | 4.400 | no | -26.1 LUFS / -16.6 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 6 |
| `music/dropin-07.m4a` (+ `.web.m4a`) | drop-in | 4.100 | no | -26.0 LUFS / -16.0 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 7 |
| `music/dropin-08.m4a` (+ `.web.m4a`) | drop-in | 4.100 | no | -26.0 LUFS / -14.5 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft2 phrase 8 |
| `music/dropin-09.m4a` (+ `.web.m4a`) | drop-in | 4.100 | no | -26.0 LUFS / -9.9 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 1 |
| `music/dropin-10.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -9.6 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 2 |
| `music/dropin-11.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -14.4 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 3 |
| `music/dropin-12.m4a` (+ `.web.m4a`) | drop-in | 5.400 | no | -26.0 LUFS / -9.7 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 4 |
| `music/dropin-13.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -10.9 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 5 |
| `music/dropin-14.m4a` (+ `.web.m4a`) | drop-in | 4.200 | no | -26.0 LUFS / -10.9 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 6 |
| `music/dropin-15.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -12.0 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 7 |
| `music/dropin-16.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -12.8 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-3 draft2 (pitch-corrected -100 c) phrase 8 |
| `music/dropin-17.m4a` (+ `.web.m4a`) | drop-in | 4.500 | no | -26.0 LUFS / -10.8 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 1 |
| `music/dropin-18.m4a` (+ `.web.m4a`) | drop-in | 4.400 | no | -26.0 LUFS / -14.7 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 2 |
| `music/dropin-19.m4a` (+ `.web.m4a`) | drop-in | 4.000 | no | -26.0 LUFS / -14.9 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 3 |
| `music/dropin-20.m4a` (+ `.web.m4a`) | drop-in | 4.100 | no | -26.0 LUFS / -13.9 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 4 |
| `music/dropin-21.m4a` (+ `.web.m4a`) | drop-in | 6.900 | no | -26.0 LUFS / -16.7 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 5 |
| `music/dropin-22.m4a` (+ `.web.m4a`) | drop-in | 4.500 | no | -26.0 LUFS / -16.5 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 6 |
| `music/dropin-23.m4a` (+ `.web.m4a`) | drop-in | 5.000 | no | -26.0 LUFS / -14.1 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 7 |
| `music/dropin-24.m4a` (+ `.web.m4a`) | drop-in | 4.200 | no | -26.0 LUFS / -14.8 dBTP | Random, every 20 to 60 s while idle | dropin-01..24 | source-2 draft1 phrase 8 |
| `sfx/swipe-next-a.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -12.0 dBFS, -30.5 LUFS | Swipe to the next card commits (forward direction) | swipe-next-b, swipe-next-c | proof pick (air draft3) |
| `sfx/swipe-next-b.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -9.9 dBFS, -30.4 LUFS | Swipe to the next card commits (forward direction) | swipe-next-a | proof air draft1; processed here (trim 0.48 s, 5/50 ms fades, mono, peak -12 dBFS) like next-a; processed from raw MP3 (peak -12 dBFS) |
| `sfx/swipe-next-c.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -12.3 dBFS, -28.8 LUFS | Swipe to the next card commits (forward direction) | swipe-next-a | proof air draft2; processed here (trim 0.48 s, 5/50 ms fades, mono, peak -12 dBFS) like next-a; processed from raw MP3 (peak -12 dBFS) |
| `sfx/swipe-back-a.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -12.3 dBFS, -31.2 LUFS | Swipe to the previous card commits | - | derived: reversed air draft3 |
| `sfx/swipe-tone-up.m4a` (+ `.web.m4a`) | sfx | 0.450 | no | peak -6.6 dBFS, -17.8 LUFS | Optional layer with swipe-next, about -10 dB under the air (off by default) | swipe-tone-down | synthesized sine glide D4 to E4 |
| `sfx/swipe-tone-down.m4a` (+ `.web.m4a`) | sfx | 0.450 | no | peak -7.4 dBFS, -17.9 LUFS | Optional layer with swipe-back, about -10 dB under the air (off by default) | swipe-tone-up | synthesized sine glide E4 to D4 |
| `sfx/card-flip-a.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -12.0 dBFS, -21.7 LUFS | Card flips to its back | card-flip-c | proof pick draft2 |
| `sfx/card-flip-c.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -11.8 dBFS, -22.7 LUFS | Card flips to its back | card-flip-a | draft1 (flip-b skipped: unusable) |
| `sfx/card-flip-back-a.m4a` (+ `.web.m4a`) | sfx | 0.460 | no | peak -13.0 dBFS, -22.2 LUFS | Card flips back to its front | card-flip-back-c | derived from flip-a |
| `sfx/card-flip-back-c.m4a` (+ `.web.m4a`) | sfx | 0.480 | no | peak -13.0 dBFS, -24.3 LUFS | Card flips back to its front | card-flip-back-a | derived from flip-c |
| `sfx/swipe-cancel-a.m4a` (+ `.web.m4a`) | sfx | 0.250 | no | peak -17.8 dBFS | Card springs back after a short drag | swipe-cancel-b | draft1, planned peak -18 dBFS |
| `sfx/swipe-cancel-b.m4a` (+ `.web.m4a`) | sfx | 0.250 | no | peak -18.2 dBFS | Card springs back after a short drag | swipe-cancel-a | draft3, planned peak -18 dBFS |
| `sfx/swipe-resistance-a.m4a` (+ `.web.m4a`) | sfx | 0.220 | no | peak -21.3 dBFS | Swiping back at the first card | swipe-resistance-b | derived from cancel-a |
| `sfx/swipe-resistance-b.m4a` (+ `.web.m4a`) | sfx | 0.220 | no | peak -21.1 dBFS | Swiping back at the first card | swipe-resistance-a | derived from cancel-b |
| `sfx/complexity-1.m4a` (+ `.web.m4a`) | sfx | 0.600 | no | peak -12.0 dBFS, -24.9 LUFS | Complexity changes to level 1 | complexity-1..5 | derived (D5) from complexity-source draft3 |
| `sfx/complexity-2.m4a` (+ `.web.m4a`) | sfx | 0.600 | no | peak -12.1 dBFS, -25.0 LUFS | Complexity changes to level 2 | complexity-1..5 | derived (E5) from complexity-source draft3 |
| `sfx/complexity-3.m4a` (+ `.web.m4a`) | sfx | 0.600 | no | peak -12.0 dBFS, -25.1 LUFS | Complexity changes to level 3 | complexity-1..5 | derived (F5) from complexity-source draft3 |
| `sfx/complexity-4.m4a` (+ `.web.m4a`) | sfx | 0.600 | no | peak -11.9 dBFS, -25.0 LUFS | Complexity changes to level 4 | complexity-1..5 | derived (A5) from complexity-source draft3 |
| `sfx/complexity-5.m4a` (+ `.web.m4a`) | sfx | 0.600 | no | peak -10.1 dBFS, -24.9 LUFS | Complexity changes to level 5 | complexity-1..5 | derived (B5) from complexity-source draft3 |
| `sfx/laterality-snap-1.m4a` (+ `.web.m4a`) | sfx | 0.300 | no | peak -12.0 dBFS | Laterality rail snaps to step 1 | laterality-snap-1..5 | derived (D6) from snap-source draft1 |
| `sfx/laterality-snap-2.m4a` (+ `.web.m4a`) | sfx | 0.300 | no | peak -12.0 dBFS | Laterality rail snaps to step 2 | laterality-snap-1..5 | derived (E6) from snap-source draft1 |
| `sfx/laterality-snap-3.m4a` (+ `.web.m4a`) | sfx | 0.300 | no | peak -12.1 dBFS | Laterality rail snaps to step 3 | laterality-snap-1..5 | derived (F6) from snap-source draft1 |
| `sfx/laterality-snap-4.m4a` (+ `.web.m4a`) | sfx | 0.300 | no | peak -12.0 dBFS | Laterality rail snaps to step 4 | laterality-snap-1..5 | derived (A6) from snap-source draft1 |
| `sfx/laterality-snap-5.m4a` (+ `.web.m4a`) | sfx | 0.300 | no | peak -12.0 dBFS | Laterality rail snaps to step 5 | laterality-snap-1..5 | derived (B6) from snap-source draft1 |
| `sfx/reshuffle-gather.m4a` (+ `.web.m4a`) | sfx | 1.118 | no | peak -12.1 dBFS, -22.7 LUFS | Reshuffle starts | - | draft2 |
| `sfx/reshuffle-land-a.m4a` (+ `.web.m4a`) | sfx | 1.480 | no | peak -10.3 dBFS, -27.4 LUFS | The new card lands | reshuffle-land-b | draft3 |
| `sfx/reshuffle-land-b.m4a` (+ `.web.m4a`) | sfx | 1.480 | no | peak -11.4 dBFS, -46.5 LUFS | The new card lands | reshuffle-land-a | draft1 |
| `sfx/reshuffle-land-wide.m4a` (+ `.web.m4a`) | sfx | 2.000 | no | peak -12.0 dBFS, -25.4 LUFS | Landing after "Random entry" | - | draft2 |
| `sfx/card-arrive-a.m4a` (+ `.web.m4a`) | sfx | 0.400 | no | peak -12.0 dBFS, -27.2 LUFS | A card appears outside a reshuffle (on load, after a reshuffle, after error recovery) | card-arrive-b | draft2 |
| `sfx/card-arrive-b.m4a` (+ `.web.m4a`) | sfx | 0.400 | no | peak -11.3 dBFS, -25.6 LUFS | A card appears outside a reshuffle (on load, after a reshuffle, after error recovery) | card-arrive-a | draft1 |
| `sfx/sheet-open.m4a` (+ `.web.m4a`) | sfx | 0.400 | no | peak -12.0 dBFS, -22.0 LUFS | Menu sheet opens | sheet-close | draft1 |
| `sfx/sheet-close.m4a` (+ `.web.m4a`) | sfx | 0.389 | no | peak -12.1 dBFS | Menu sheet closes | sheet-open | derived: sheet-open draft1 reversed |
| `sfx/error-soft-a.m4a` (+ `.web.m4a`) | sfx | 0.900 | no | peak -12.0 dBFS, -23.2 LUFS | Errors such as "Couldn't load the next idea" | error-soft-b | draft1 |
| `sfx/error-soft-b.m4a` (+ `.web.m4a`) | sfx | 0.900 | no | peak -12.1 dBFS, -23.5 LUFS | Errors such as "Couldn't load the next idea" | error-soft-a | draft2 |
| `sfx/no-match-soft.m4a` (+ `.web.m4a`) | sfx | 0.900 | no | peak -16.0 dBFS, -27.3 LUFS | "No next idea at this setting" | - | derived from error-soft draft1 |

## Mix levels
- Music bus: every music file is normalized to -26 LUFS integrated, true peak at or below -2 dBTP (measured -9.6 to -17.3 dBTP). Beds, textures, intro, arrival tones and drop-ins all sit at -26 LUFS; balance between layers is done in the app with `gainDb` (0 by default in the manifest).
- Effects: peak about -12 dBFS. Planned exceptions, kept as delivered and not re-normalized: swipe-cancel -18, swipe-resistance -21 (derived), card-flip-back -13 (derived), no-match-soft -16 (derived). Swipe-back, sheet-close and the complexity and laterality ladders are derived and keep their own level (about -12 dBFS).
- Tone layers (`swipe-tone-up` / `-down`) are synthesized sine glides delivered at their own level (peak about -7 dBFS); the app plays them about -10 dB under the air sweep.
- Normalization in this package: only `swipe-next-b` and `-c` (proof air drafts 1 and 2, which had no processed copy) were trimmed to 0.48 s with 5 ms / 50 ms fades, mixed to mono and set to peak -12 dBFS, matching `swipe-next-a`. Every other source was already at its target and was only encoded.

## Loops
Loops (`bed-*`, `texture-*`, `intro-loop`) are encoded without padding. The m4a files carry an edit list, so the container duration is sample-exact (for example `intro-loop` = 264,600 samples = 6.000 s) and the AAC encoder delay is hidden at the start (checked: zero lag against the source). The last AAC frame is padded to a 1024-sample boundary (12 to 616 extra samples; 14 ms on `intro-loop`). Players that honour the edit list (AVFoundation, ExoPlayer) loop cleanly. On the web, or with a decoder that ignores it, loop with Web Audio `AudioBufferSourceNode` and set `loopEnd = durationMs / 1000` from the manifest to avoid a short gap.

## Behaviour decisions
- Tone layers are off by default (internal flag).
- A vertical swipe plays only the complexity note.
- `card-arrive` plays on load, after a reshuffle and after error recovery.
- `reshuffle-gather` rings out once, then there is silence until `reshuffle-land`.
- Reduced motion: motion-tied sfx play 3 dB lower with shorter fades.
- Audio mixes with other apps and does not duck them; music does not start if another app is playing.
- When the master switch is off, the Music and Effects switches show disabled.
- No random pitch shift.

## Source of truth
The ClickUp doc is the source of truth: https://app.clickup.com/90122060531/docs/2kxv30qk-1012. The asset list (names, triggers, planned levels) lives there and in `asset-list.md`.

## Prompts (Annex A)
Every generated sound has its ElevenLabs prompt, model, settings and generation ID in Annex A of the sound design document (A4 planned prompts, A5 to A8 run logs). Derived and synthesized files list their ffmpeg commands there too.

## Provenance
AI-generated with ElevenLabs (music and sound effects), post-processed with ffmpeg (trim, loop crossfades, pitch correction with rubberband, reverse, filtering, loudness normalization, AAC encoding). `swipe-tone-up` / `-down` are synthesized with ffmpeg. No new audio was generated for this package. Final listening sign-off comes from the audio director and Carlos.
