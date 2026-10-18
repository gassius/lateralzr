import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { webPreview } from '../theme/tokens.ts';
import {
  WEB_PHONE_ASPECT_RATIO,
  WEB_PHONE_MAX_WIDTH,
  WEB_PHONE_MIN_HEIGHT,
  WEB_PHONE_MIN_WIDTH,
  webPhoneFrameSize,
  webPreviewSimulatedInsets,
} from './webPhoneFrame.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('webPhoneFrameSize', () => {
  it('fills a typical iPhone viewport without letterboxing', () => {
    assert.deepEqual(webPhoneFrameSize(390, 844), {
      width: 390,
      height: 844,
      framed: false,
    });
  });

  it('fills when width is exactly the max phone width', () => {
    assert.deepEqual(webPhoneFrameSize(WEB_PHONE_MAX_WIDTH, 932), {
      width: WEB_PHONE_MAX_WIDTH,
      height: 932,
      framed: false,
    });
  });

  it('letterboxes a wide desktop into a mobile portrait frame', () => {
    const size = webPhoneFrameSize(1440, 1080);
    assert.equal(size.framed, true);
    assert.equal(size.width, WEB_PHONE_MAX_WIDTH);
    assert.equal(size.height, Math.round(WEB_PHONE_MAX_WIDTH * WEB_PHONE_ASPECT_RATIO));
    assert.ok(size.width < 1440);
    assert.ok(size.height <= 1080);
  });

  it('shrinks width to keep portrait aspect when the window is shorter than a phone', () => {
    const size = webPhoneFrameSize(1280, 800);
    assert.equal(size.framed, true);
    assert.equal(size.height, 800);
    assert.equal(size.width, Math.round(800 / WEB_PHONE_ASPECT_RATIO));
    assert.ok(size.width >= WEB_PHONE_MIN_WIDTH);
  });

  it('does not frame a landscape phone into a tiny portrait slab', () => {
    assert.deepEqual(webPhoneFrameSize(844, 390), {
      width: 844,
      height: 390,
      framed: false,
    });
  });

  it('does not frame when the fitted phone would be below min size', () => {
    const size = webPhoneFrameSize(1200, WEB_PHONE_MIN_HEIGHT - 1);
    assert.equal(size.framed, false);
    assert.equal(size.width, 1200);
    assert.equal(size.height, WEB_PHONE_MIN_HEIGHT - 1);
  });

  it('defaults to a framed phone when viewport metrics are not ready', () => {
    const size = webPhoneFrameSize(0, 0);
    assert.equal(size.framed, true);
    assert.equal(size.width, WEB_PHONE_MAX_WIDTH);
    assert.equal(size.height, Math.round(WEB_PHONE_MAX_WIDTH * WEB_PHONE_ASPECT_RATIO));
  });
});

describe('native isolation', () => {
  const nativeSrc = readFileSync(join(here, '../components/WebPhoneFrame.tsx'), 'utf8');
  const webSrc = readFileSync(join(here, '../components/WebPhoneFrame.web.tsx'), 'utf8');

  it('native WebPhoneFrame is a passthrough with a null size hook', () => {
    assert.match(nativeSrc, /SafeAreaProvider/);
    assert.match(nativeSrc, /return null/);
    assert.equal(nativeSrc.includes('webPhoneFrameSize('), false);
    assert.equal(nativeSrc.includes('StyleSheet'), false);
    assert.equal(nativeSrc.includes('webPreview'), false);
  });

  it('web override is the only file that sizes a phone frame', () => {
    assert.match(webSrc, /webPhoneFrameSize\(/);
    assert.match(webSrc, /web-phone-stage/);
    assert.match(webSrc, /web-phone-frame/);
    assert.match(webSrc, /lateralzr-web-phone-frame/);
    assert.match(webSrc, /webPreview\.outside/);
    assert.match(webSrc, /webPreviewSimulatedInsets/);
  });
});

describe('v3.4 web preview surround (§16.3)', () => {
  it('simulates 47/34 insets and pins the near-black surround token', () => {
    assert.deepEqual(webPreviewSimulatedInsets(), {
      top: 47,
      left: 0,
      right: 0,
      bottom: 34,
    });
    assert.equal(webPreview.outside, '#0E1012');
    assert.equal(webPreview.frameEdge, '#FFFFFF1A');
  });
});
