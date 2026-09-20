/**
 * Web GTM helpers. Safe to import from Node tests and from `+html.tsx`
 * (static export). DOM writes happen only in {@link injectGtmWeb}.
 *
 * Expo `web.output: "single"` (SPA) does not emit `app/+html.tsx` into the
 * Vercel HTML shell, so production must call {@link injectGtmWeb} at runtime.
 */

export const GTM_WEB_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;
export const GTM_SCRIPT_MARKER = 'data-lateralzr-gtm';
export const GTM_NOSCRIPT_MARKER = 'data-lateralzr-gtm-ns';
export const GTM_SCRIPT_ORIGIN = 'https://www.googletagmanager.com/gtm.js';
export const GTM_NOSCRIPT_ORIGIN = 'https://www.googletagmanager.com/ns.html';

export function parseGtmWebId(raw: string | undefined | null): string | undefined {
  const id = raw?.trim() ?? '';
  return GTM_WEB_ID_PATTERN.test(id) ? id : undefined;
}

export function gtmScriptUrl(id: string): string {
  return `${GTM_SCRIPT_ORIGIN}?id=${encodeURIComponent(id)}`;
}

export function gtmNoscriptUrl(id: string): string {
  return `${GTM_NOSCRIPT_ORIGIN}?id=${encodeURIComponent(id)}`;
}

export type GtmWindow = {
  dataLayer?: Array<Record<string, unknown>>;
};

export type GtmElement = {
  async?: boolean;
  src?: string;
  setAttribute?: (name: string, value: string) => void;
  getAttribute?: (name: string) => string | null;
};

export type GtmDocument = {
  querySelector: (selector: string) => GtmElement | null;
  createElement: (tag: string) => GtmElement;
  head?: { appendChild: (el: GtmElement) => void };
  body?: { insertAdjacentHTML?: (position: string, html: string) => void };
};

function hasInjectedGtmScript(doc: GtmDocument): boolean {
  return (
    doc.querySelector(`script[${GTM_SCRIPT_MARKER}]`) != null ||
    doc.querySelector(`script[src^="${GTM_SCRIPT_ORIGIN}"]`) != null
  );
}

function appendGtmScript(doc: GtmDocument, id: string): void {
  const script = doc.createElement('script');
  script.async = true;
  script.src = gtmScriptUrl(id);
  script.setAttribute?.(GTM_SCRIPT_MARKER, id);
  doc.head?.appendChild(script);
}

/**
 * GTM's noscript iframe only helps when JS is off. SPA still benefits when
 * `+html.tsx` is emitted (non-`single` output). Runtime inject adds the same
 * markup if `body` is available so Preview/DOM stay aligned.
 */
function appendGtmNoscript(doc: GtmDocument, id: string): void {
  if (doc.querySelector(`iframe[${GTM_NOSCRIPT_MARKER}]`) != null) return;
  if (doc.querySelector(`iframe[src^="${GTM_NOSCRIPT_ORIGIN}"]`) != null) return;
  const html = `<noscript><iframe ${GTM_NOSCRIPT_MARKER}="${id}" src="${gtmNoscriptUrl(id)}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`;
  doc.body?.insertAdjacentHTML?.('afterbegin', html);
}

/**
 * Standard GTM bootstrap: init `dataLayer`, push `gtm.start`, append `gtm.js`.
 * Returns true when this call appended the script. Invalid IDs, missing DOM,
 * and a second call are no-ops (false).
 */
export function injectGtmWeb(
  rawId: string | undefined | null,
  globals?: { window?: GtmWindow; document?: GtmDocument },
): boolean {
  const id = parseGtmWebId(rawId);
  const win = globals?.window ?? (typeof window === 'undefined' ? undefined : window);
  const doc = globals?.document ?? (typeof document === 'undefined' ? undefined : document);
  if (!id || !win || !doc) return false;
  if (hasInjectedGtmScript(doc)) return false;

  win.dataLayer = win.dataLayer ?? [];
  win.dataLayer.push({
    'gtm.start': Date.now(),
    event: 'gtm.js',
  });

  appendGtmScript(doc, id);
  appendGtmNoscript(doc, id);
  return true;
}
