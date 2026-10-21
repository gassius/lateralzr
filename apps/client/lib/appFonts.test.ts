import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { font } from '../theme/tokens.ts';
import { APP_FONT_FAMILIES, appFontsReady } from './appFonts.ts';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');

describe('bundled Inter (Lz-66)', () => {
  it('maps 400/500/600/700 to explicit family names', () => {
    assert.deepEqual(APP_FONT_FAMILIES, {
      regular: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semiBold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
    });
    assert.deepEqual(APP_FONT_FAMILIES, font.family);
  });

  it('treats a load error as ready so the intro logo still shows', () => {
    assert.equal(appFontsReady(false, null), false);
    assert.equal(appFontsReady(true, null), true);
    assert.equal(appFontsReady(false, new Error('missing')), true);
  });

  it('commits the SIL OFL 1.1 licence next to the font tokens', () => {
    const ofl = join(clientRoot, 'assets/fonts/OFL.txt');
    assert.ok(existsSync(ofl), 'missing assets/fonts/OFL.txt');
    const text = readFileSync(ofl, 'utf8');
    assert.match(text, /SIL Open Font License, Version 1.1/);
    assert.match(text, /Inter Project Authors/);
  });

  it('tints Android nav bar and enables edge-to-edge in app.json', () => {
    const appJson = JSON.parse(
      readFileSync(join(clientRoot, 'app.json'), 'utf8'),
    ) as {
      expo: {
        android?: { edgeToEdgeEnabled?: boolean };
        androidNavigationBar?: { backgroundColor?: string; barStyle?: string };
        plugins: Array<string | [string, unknown]>;
      };
    };
    assert.equal(appJson.expo.android?.edgeToEdgeEnabled, true);
    assert.equal(appJson.expo.androidNavigationBar?.backgroundColor, '#082D3D');
    assert.equal(appJson.expo.androidNavigationBar?.barStyle, 'light-content');
    const navPlugin = appJson.expo.plugins.find(
      (plugin): plugin is [string, { style?: string; enforceContrast?: boolean }] =>
        Array.isArray(plugin) && plugin[0] === 'expo-navigation-bar',
    );
    assert.ok(navPlugin);
    assert.equal(navPlugin[1].style, 'light');
    assert.equal(navPlugin[1].enforceContrast, false);
  });

  it('loads fonts via expo-font useFonts and keeps the intro logo mounted', () => {
    const hookSrc = readFileSync(join(clientRoot, 'hooks/appFontsContext.tsx'), 'utf8');
    const layoutSrc = readFileSync(join(clientRoot, 'app/_layout.tsx'), 'utf8');
    const indexSrc = readFileSync(join(clientRoot, 'app/index.tsx'), 'utf8');
    assert.match(hookSrc, /from 'expo-font'/);
    assert.match(hookSrc, /useFonts\(APP_FONT_SOURCES\)/);
    assert.match(layoutSrc, /AppFontsProvider/);
    assert.match(layoutSrc, /SplashScreen\.hideAsync/);
    assert.match(indexSrc, /useAppFontsReady/);
    assert.match(indexSrc, /!fontsReady/);
    assert.match(indexSrc, /<LateralzrLogo/);
  });
});
