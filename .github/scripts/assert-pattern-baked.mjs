/**
 * CI: re-bake pattern rasters and fail if committed assets diverge.
 * Also asserts manifest filenames use `-3x.webp` (not Metro `@3x`).
 *
 * Usage: node .github/scripts/assert-pattern-baked.mjs
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bakedDir = path.join(root, 'apps/client/assets/images/pattern/baked');
const clientDir = path.join(root, 'apps/client');

function fileHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function snapshotDir(dir) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    map.set(name, fileHash(path.join(dir, name)));
  }
  return map;
}

if (!existsSync(bakedDir)) {
  console.error(`missing baked dir: ${bakedDir}`);
  process.exit(1);
}

const before = snapshotDir(bakedDir);
const manifestPath = path.join(bakedDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.format !== 'webp') {
  console.error(`manifest.format must be "webp", got ${JSON.stringify(manifest.format)}`);
  process.exit(1);
}

for (const v of manifest.variants ?? []) {
  for (const key of ['front', 'emboss']) {
    const name = v[key];
    if (typeof name !== 'string' || !name.includes(`-${manifest.scale}x.webp`)) {
      console.error(`bad ${key} name for variant ${v.key}: ${name} (want -${manifest.scale}x.webp)`);
      process.exit(1);
    }
    if (name.includes('@')) {
      console.error(`Metro density suffix not allowed: ${name}`);
      process.exit(1);
    }
    if (!before.has(name)) {
      console.error(`manifest lists missing file: ${name}`);
      process.exit(1);
    }
  }
}

for (const extra of [manifest.glowLine, manifest.glowNode, manifest.paperFade]) {
  if (typeof extra === 'string' && !before.has(extra)) {
    console.error(`manifest lists missing file: ${extra}`);
    process.exit(1);
  }
}

console.log('re-baking patterns…');
execFileSync('pnpm', ['bake:patterns'], { cwd: clientDir, stdio: 'inherit' });

const after = snapshotDir(bakedDir);
const beforeKeys = [...before.keys()];
const afterKeys = [...after.keys()];

if (beforeKeys.join('\0') !== afterKeys.join('\0')) {
  console.error('baked file set changed after re-bake:');
  console.error('  before:', beforeKeys.join(', '));
  console.error('  after:', afterKeys.join(', '));
  process.exit(1);
}

const mismatches = [];
for (const name of beforeKeys) {
  if (before.get(name) !== after.get(name)) {
    mismatches.push(name);
  }
}

if (mismatches.length > 0) {
  console.error('baked assets drift after re-bake (commit `pnpm bake:patterns` output):');
  for (const name of mismatches) {
    console.error(`  ${name}`);
  }
  process.exit(1);
}

console.log(`ok: ${beforeKeys.length} baked assets match re-bake`);
