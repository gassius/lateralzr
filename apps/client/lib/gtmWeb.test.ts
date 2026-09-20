import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  GTM_NOSCRIPT_MARKER,
  GTM_NOSCRIPT_ORIGIN,
  GTM_SCRIPT_MARKER,
  GTM_SCRIPT_ORIGIN,
  gtmNoscriptUrl,
  gtmScriptUrl,
  injectGtmWeb,
  parseGtmWebId,
  type GtmDocument,
  type GtmElement,
  type GtmWindow,
} from './gtmWeb';

function createFakeDom(preloaded: { scripts?: GtmElement[]; iframes?: GtmElement[] } = {}) {
  const scripts = [...(preloaded.scripts ?? [])];
  const iframes = [...(preloaded.iframes ?? [])];
  const htmlChunks: string[] = [];

  const doc: GtmDocument = {
    querySelector(selector: string) {
      if (selector === `script[${GTM_SCRIPT_MARKER}]`) {
        return scripts.find((el) => el.getAttribute?.(GTM_SCRIPT_MARKER)) ?? null;
      }
      if (selector === `script[src^="${GTM_SCRIPT_ORIGIN}"]`) {
        return scripts.find((el) => el.src?.startsWith(GTM_SCRIPT_ORIGIN)) ?? null;
      }
      if (selector === `iframe[${GTM_NOSCRIPT_MARKER}]`) {
        return iframes.find((el) => el.getAttribute?.(GTM_NOSCRIPT_MARKER)) ?? null;
      }
      if (selector === `iframe[src^="${GTM_NOSCRIPT_ORIGIN}"]`) {
        return iframes.find((el) => el.src?.startsWith(GTM_NOSCRIPT_ORIGIN)) ?? null;
      }
      return null;
    },
    createElement() {
      const attrs: Record<string, string> = {};
      const el: GtmElement = {
        async: false,
        src: '',
        setAttribute(name, value) {
          attrs[name] = value;
        },
        getAttribute(name) {
          return attrs[name] ?? null;
        },
      };
      return el;
    },
    head: {
      appendChild(el) {
        scripts.push(el);
      },
    },
    body: {
      insertAdjacentHTML(_position, html) {
        htmlChunks.push(html);
      },
    },
  };

  const win: GtmWindow = {};
  return { win, doc, scripts, htmlChunks };
}

test('parseGtmWebId accepts GTM-XXXX and trims whitespace', () => {
  assert.equal(parseGtmWebId('GTM-TEST1'), 'GTM-TEST1');
  assert.equal(parseGtmWebId('  gtm-abc9  '), 'gtm-abc9');
});

test('parseGtmWebId skips empty, malformed, and measurement IDs', () => {
  assert.equal(parseGtmWebId(undefined), undefined);
  assert.equal(parseGtmWebId(''), undefined);
  assert.equal(parseGtmWebId('   '), undefined);
  assert.equal(parseGtmWebId('GTM-'), undefined);
  assert.equal(parseGtmWebId('not-a-container'), undefined);
  assert.equal(parseGtmWebId('G-XXXXXXXXXX'), undefined);
  assert.equal(parseGtmWebId('GTM-TEST!'), undefined);
});

test('injectGtmWeb skips invalid IDs and missing DOM', () => {
  const { win, doc, scripts } = createFakeDom();
  assert.equal(injectGtmWeb('G-XXXXXXXXXX', { window: win, document: doc }), false);
  assert.equal(injectGtmWeb('GTM-TEST1'), false);
  assert.equal(scripts.length, 0);
  assert.equal(win.dataLayer, undefined);
});

test('injectGtmWeb inits dataLayer, pushes gtm.start, and appends gtm.js', () => {
  const { win, doc, scripts, htmlChunks } = createFakeDom();
  assert.equal(injectGtmWeb('GTM-TEST1', { window: win, document: doc }), true);

  assert.equal(scripts.length, 1);
  assert.equal(scripts[0]?.src, gtmScriptUrl('GTM-TEST1'));
  assert.equal(scripts[0]?.async, true);
  assert.equal(scripts[0]?.getAttribute?.(GTM_SCRIPT_MARKER), 'GTM-TEST1');

  assert.ok(Array.isArray(win.dataLayer));
  assert.equal(win.dataLayer?.[0]?.event, 'gtm.js');
  assert.equal(typeof win.dataLayer?.[0]?.['gtm.start'], 'number');

  assert.equal(htmlChunks.length, 1);
  assert.match(htmlChunks[0] ?? '', /<noscript>/);
  assert.ok((htmlChunks[0] ?? '').includes(gtmNoscriptUrl('GTM-TEST1')));
});

test('injectGtmWeb is idempotent', () => {
  const { win, doc, scripts, htmlChunks } = createFakeDom();
  assert.equal(injectGtmWeb('GTM-TEST1', { window: win, document: doc }), true);
  assert.equal(injectGtmWeb('GTM-TEST1', { window: win, document: doc }), false);
  assert.equal(scripts.length, 1);
  assert.equal(win.dataLayer?.length, 1);
  assert.equal(htmlChunks.length, 1);
});

test('injectGtmWeb keeps events already queued on dataLayer', () => {
  const { win, doc } = createFakeDom();
  win.dataLayer = [{ event: 'card_view', concept: 'Orbit' }];

  assert.equal(injectGtmWeb('GTM-TEST1', { window: win, document: doc }), true);
  assert.equal(win.dataLayer?.[0]?.event, 'card_view');
  assert.equal(win.dataLayer?.[1]?.event, 'gtm.js');
});

test('injectGtmWeb skips when +html (or another loader) already added gtm.js', () => {
  const existing: GtmElement = {
    src: `${GTM_SCRIPT_ORIGIN}?id=GTM-TEST1`,
    getAttribute: () => null,
  };
  const { win, doc, scripts } = createFakeDom({ scripts: [existing] });
  win.dataLayer = [{ event: 'card_view' }];

  assert.equal(injectGtmWeb('GTM-TEST1', { window: win, document: doc }), false);
  assert.equal(scripts.length, 1);
  assert.deepEqual(win.dataLayer, [{ event: 'card_view' }]);
});

test('native analytics never loads web gtm.js', () => {
  const nativeSrc = fs.readFileSync(path.join(__dirname, 'analytics.ts'), 'utf8');
  const webSrc = fs.readFileSync(path.join(__dirname, 'analytics.web.ts'), 'utf8');
  const layoutSrc = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');

  assert.match(nativeSrc, /export function ensureGtmWebLoaded/);
  assert.match(nativeSrc, /return false/);
  assert.equal(nativeSrc.includes('googletagmanager.com'), false);
  assert.equal(nativeSrc.includes('injectGtmWeb'), false);

  assert.match(webSrc, /injectGtmWeb/);
  assert.match(webSrc, /ensureGtmWebLoaded/);
  assert.match(layoutSrc, /ensureGtmWebLoaded/);
  assert.match(layoutSrc, /useLayoutEffect/);
});
