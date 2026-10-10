export const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844 },
  { id: '320x568', width: 320, height: 568 },
  /** Lz-24 AC2 — short/wide phone band alongside SE-class 320. */
  { id: '430x932', width: 430, height: 932 },
  { id: '1280x800', width: 1280, height: 800 },
] as const;

export type ViewportId = (typeof VIEWPORTS)[number]['id'];

export const FIXED_CLOCK_ISO = '2026-01-15T12:00:00.000Z';
/** Intro logo holds ~3s even when the API is instant. */
export const INTRO_FAST_FORWARD_MS = 3_500;
