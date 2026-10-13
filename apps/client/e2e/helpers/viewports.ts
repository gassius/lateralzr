export const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844 },
] as const;

export type ViewportId = (typeof VIEWPORTS)[number]['id'];

export const FIXED_CLOCK_ISO = '2026-01-15T12:00:00.000Z';
/** Intro logo holds ~3s even when the API is instant. */
export const INTRO_FAST_FORWARD_MS = 3_500;
