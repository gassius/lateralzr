import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { LOGO_SVG_ON_PAPER } from '../assets/images/logo/lateralzrLogoOnPaper.ts';
import { ABOUT_LOGO_WIDTH } from './appMenu.ts';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');
const onPaperSvgPath = join(clientRoot, 'assets/images/logo/lateralzr-logo-on-paper.svg');

describe('Lz-47 About assets', () => {
  it('keeps the on-paper SVG module identical to the asset file', () => {
    assert.ok(existsSync(onPaperSvgPath), 'missing lateralzr-logo-on-paper.svg');
    const disk = readFileSync(onPaperSvgPath, 'utf8');
    assert.equal(LOGO_SVG_ON_PAPER, disk);
  });

  it('pins About lockup width and app.json version 1.0.0', () => {
    assert.equal(ABOUT_LOGO_WIDTH, 160);
    const appJson = JSON.parse(readFileSync(join(clientRoot, 'app.json'), 'utf8')) as {
      expo: { version: string };
    };
    assert.equal(appJson.expo.version, '1.0.0');
  });
});
