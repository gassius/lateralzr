import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');

type SplashPlugin = [
  'expo-splash-screen',
  { image: string; backgroundColor: string; resizeMode?: string },
];

const appJson = JSON.parse(readFileSync(join(clientRoot, 'app.json'), 'utf8')) as {
  expo: {
    name: string;
    icon: string;
    android: { adaptiveIcon: { foregroundImage: string; backgroundColor: string } };
    web: { favicon: string };
    plugins: Array<string | SplashPlugin | [string, unknown]>;
  };
};

function splashPluginConfig(): SplashPlugin[1] {
  const entry = appJson.expo.plugins.find(
    (plugin): plugin is SplashPlugin =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  assert.ok(entry, 'expo-splash-screen plugin missing from app.json');
  return entry[1];
}

function resolveAsset(rel: string): string {
  return join(clientRoot, rel.replace(/^\.\//, ''));
}

describe('Lz-23 logo assets wired in app.json', () => {
  it('uses the Lateralzr web title (not the Expo template name)', () => {
    assert.equal(appJson.expo.name, 'Lateralzr');
  });

  it('points icon, splash, adaptive foreground, and favicon at shipped logo files', () => {
    const splash = splashPluginConfig();
    const paths = [
      appJson.expo.icon,
      splash.image,
      appJson.expo.android.adaptiveIcon.foregroundImage,
      appJson.expo.web.favicon,
    ];
    for (const rel of paths) {
      assert.match(rel, /assets\/images\/logo\//);
      assert.ok(existsSync(resolveAsset(rel)), `missing asset: ${rel}`);
    }
  });

  it('uses orange tile backgrounds for splash and Android adaptive icon', () => {
    const splash = splashPluginConfig();
    assert.equal(splash.backgroundColor.toUpperCase(), '#F78D1E');
    assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor.toUpperCase(), '#F78D1E');
  });

  it('keeps the master SVG byte-identical to the path-module source file', () => {
    const master = readFileSync(
      join(clientRoot, 'assets/images/logo/lateralzr-logo-master.svg'),
    );
    const legacy = readFileSync(join(clientRoot, 'assets/images/lateralzr_logo.svg'));
    assert.ok(master.equals(legacy));
  });
});
