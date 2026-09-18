'use strict';

/**
 * Node 20-friendly tests for webPhoneFrame.ts (CI uses .nvmrc Node 20).
 * Transpiles the TypeScript source with the workspace `typescript` package.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const ts = require('typescript');

const sourcePath = path.join(__dirname, 'webPhoneFrame.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
});

const compiledPath = path.join(os.tmpdir(), `webPhoneFrame-${process.pid}.cjs`);
fs.writeFileSync(compiledPath, outputText);

const {
  WEB_PHONE_ASPECT_RATIO,
  WEB_PHONE_MAX_WIDTH,
  WEB_PHONE_MIN_HEIGHT,
  WEB_PHONE_MIN_WIDTH,
  webPhoneFrameSize,
} = require(compiledPath);

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
  const nativeSrc = fs.readFileSync(path.join(__dirname, '../components/WebPhoneFrame.tsx'), 'utf8');
  const webSrc = fs.readFileSync(path.join(__dirname, '../components/WebPhoneFrame.web.tsx'), 'utf8');

  it('native WebPhoneFrame is a passthrough with a null size hook', () => {
    assert.match(nativeSrc, /return children/);
    assert.match(nativeSrc, /return null/);
    assert.equal(nativeSrc.includes('webPhoneFrameSize('), false);
    assert.equal(nativeSrc.includes('StyleSheet'), false);
  });

  it('web override is the only file that sizes a phone frame', () => {
    assert.match(webSrc, /webPhoneFrameSize\(/);
    assert.match(webSrc, /web-phone-stage/);
    assert.match(webSrc, /web-phone-frame/);
  });
});

