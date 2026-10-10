#!/usr/bin/env node
/**
 * Assert that at least one (and at most we report two) PNG captures are
 * pixel-identical across two repeat directories.
 *
 * Usage: node assert-repeat-identical.mjs <dirA> <dirB>
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error('Usage: assert-repeat-identical.mjs <dirA> <dirB>');
  process.exit(2);
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
}

const aFiles = listPngs(dirA);
const bFiles = new Set(listPngs(dirB));
const shared = aFiles.filter((f) => bFiles.has(f));

if (!shared.length) {
  console.error('No shared PNGs between', dirA, 'and', dirB);
  process.exit(1);
}

const identical = [];
for (const file of shared) {
  const pngA = PNG.sync.read(fs.readFileSync(path.join(dirA, file)));
  const pngB = PNG.sync.read(fs.readFileSync(path.join(dirB, file)));
  if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
    console.log(`${file}: size mismatch`);
    continue;
  }
  const diff = new PNG({ width: pngA.width, height: pngA.height });
  const mismatched = pixelmatch(pngA.data, pngB.data, diff.data, pngA.width, pngA.height, {
    threshold: 0,
  });
  if (mismatched === 0) {
    identical.push(file);
    console.log(`${file}: identical`);
  } else {
    console.log(`${file}: ${mismatched} px differ`);
  }
}

if (identical.length < 1) {
  console.error('Expected ≥1 pixel-identical capture across repeats; got 0.');
  process.exit(1);
}

console.log(`OK: ${identical.length} identical capture(s) across repeats (need ≥1).`);
