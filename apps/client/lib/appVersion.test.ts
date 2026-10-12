import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { LOGO_SVG_ON_PAPER } from '../assets/images/logo/lateralzrLogoOnPaper.ts';
import { ABOUT_LOGO_WIDTH } from './appMenu.ts';
import { expoVersionFromAppJson, readAppVersion } from './appVersion.ts';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');
const onPaperSvgPath = join(clientRoot, 'assets/images/logo/lateralzr-logo-on-paper.svg');

describe('Lz-47 About assets', () => {
  it('keeps the on-paper SVG module identical to the asset file', () => {
    assert.ok(existsSync(onPaperSvgPath), 'missing lateralzr-logo-on-paper.svg');
    const disk = readFileSync(onPaperSvgPath, 'utf8');
    assert.equal(LOGO_SVG_ON_PAPER, disk);
  });

  it('pins About lockup width and reads version from app.json', () => {
    assert.equal(ABOUT_LOGO_WIDTH, 160);
    const appJson = JSON.parse(readFileSync(join(clientRoot, 'app.json'), 'utf8')) as {
      expo: { version: string };
    };
    const expectedVersion = appJson.expo.version;
    assert.equal(typeof expectedVersion, 'string');
    assert.ok(expectedVersion.length > 0);
    assert.equal(expoVersionFromAppJson(), expectedVersion);
    assert.equal(readAppVersion(), expectedVersion);
  });
});
