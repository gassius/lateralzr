/** Logical CSS width of a large modern iPhone (e.g. 14/15/16 Pro Max). */
export const WEB_PHONE_MAX_WIDTH = 430;

/** Portrait iPhone-like ratio (height / width) — 19.5:9. */
export const WEB_PHONE_ASPECT_RATIO = 19.5 / 9;

/** Don't letterbox into a slab smaller than an iPhone SE. */
export const WEB_PHONE_MIN_WIDTH = 320;
export const WEB_PHONE_MIN_HEIGHT = 568;

export type WebPhoneFrameSize = {
  width: number;
  height: number;
  /** True when the app is letterboxed inside a phone-sized portrait frame. */
  framed: boolean;
};

/**
 * Size the web preview like a mobile portrait display on wide viewports.
 * Narrow / short / landscape-phone viewports fill the window so real mobile
 * browsers are not letterboxed into a tiny slab.
 *
 * Used only by the web phone-frame UI; native builds do not import this module.
 */
export function webPhoneFrameSize(viewportWidth: number, viewportHeight: number): WebPhoneFrameSize {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    const width = WEB_PHONE_MAX_WIDTH;
    const height = Math.round(width * WEB_PHONE_ASPECT_RATIO);
    return { width, height, framed: true };
  }

  if (viewportWidth <= WEB_PHONE_MAX_WIDTH) {
    return { width: viewportWidth, height: viewportHeight, framed: false };
  }

  let width = Math.min(WEB_PHONE_MAX_WIDTH, viewportWidth);
  let height = width * WEB_PHONE_ASPECT_RATIO;
  if (height > viewportHeight) {
    height = viewportHeight;
    width = height / WEB_PHONE_ASPECT_RATIO;
  }

  width = Math.round(width);
  height = Math.round(height);

  if (width < WEB_PHONE_MIN_WIDTH || height < WEB_PHONE_MIN_HEIGHT) {
    return { width: viewportWidth, height: viewportHeight, framed: false };
  }

  return { width, height, framed: true };
}
