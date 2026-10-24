#!/usr/bin/env node
/**
 * Sound 3 size + manifest integrity check.
 *
 * Fails when:
 * - native kit (non-`.web.m4a`) exceeds 8 MiB
 * - web kit (`*.web.m4a`) exceeds 3 MiB
 * - a manifest asset is missing on disk
 * - an on-disk `.m4a` is unreferenced by the manifest
 *
 * Manifest shape matches Sound 8 consumer (`version` + `assets` map with
 * `path` / `nativePath`, `durationMs`, `loop`, optional `level` / `placeholder`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NATIVE_MAX_BYTES = 8 * 1024 * 1024;
const WEB_MAX_BYTES = 3 * 1024 * 1024;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const audioRoot = path.join(repoRoot, 'apps/client/assets/audio');
const manifestPath = path.join(audioRoot, 'manifest.json');

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listM4aFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listM4aFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.m4a')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {{ audioRoot?: string, manifestPath?: string }} [opts]
 */
export function checkAudioBudget(opts = {}) {
  const root = opts.audioRoot ?? audioRoot;
  const manPath = opts.manifestPath ?? manifestPath;
  /** @type {string[]} */
  const errors = [];

  if (!fs.existsSync(manPath)) {
    return { ok: false, errors: [`missing manifest: ${manPath}`], nativeBytes: 0, webBytes: 0 };
  }

  const manifest = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  if (manifest == null || typeof manifest !== 'object' || manifest.assets == null) {
    return {
      ok: false,
      errors: ['manifest must be Sound 8 shape: { version, assets: { … } }'],
      nativeBytes: 0,
      webBytes: 0,
    };
  }

  /** @type {Set<string>} */
  const referenced = new Set();
  for (const [name, entry] of Object.entries(manifest.assets)) {
    if (entry == null || typeof entry !== 'object') {
      errors.push(`asset ${name}: invalid entry`);
      continue;
    }
    const webRel = typeof entry.path === 'string' ? entry.path : null;
    const nativeRel =
      typeof entry.nativePath === 'string'
        ? entry.nativePath
        : webRel
          ? webRel.replace(/\.web\.m4a$/i, '.m4a')
          : null;

    if (webRel) {
      const full = path.join(root, webRel);
      referenced.add(path.resolve(full));
      if (!fs.existsSync(full)) {
        errors.push(`asset ${name}: missing web file ${webRel}`);
      }
    } else {
      errors.push(`asset ${name}: path (web) is required`);
    }

    if (nativeRel) {
      const full = path.join(root, nativeRel);
      referenced.add(path.resolve(full));
      if (!fs.existsSync(full)) {
        errors.push(`asset ${name}: missing native file ${nativeRel}`);
      }
    }

    if (entry.durationMs == null || !(Number(entry.durationMs) > 0)) {
      errors.push(`asset ${name}: durationMs required for Sound 8 loopEnd`);
    }

    if (name === 'music-texture-tonedrift-c' && entry.placeholder !== true) {
      errors.push('music-texture-tonedrift-c must keep placeholder: true');
    }
  }

  const files = listM4aFiles(root);
  let nativeBytes = 0;
  let webBytes = 0;
  for (const full of files) {
    const resolved = path.resolve(full);
    const size = fs.statSync(full).size;
    if (full.endsWith('.web.m4a')) {
      webBytes += size;
    } else {
      nativeBytes += size;
    }
    if (!referenced.has(resolved)) {
      errors.push(`unreferenced file: ${path.relative(root, full)}`);
    }
  }

  if (nativeBytes > NATIVE_MAX_BYTES) {
    errors.push(
      `native kit ${nativeBytes} bytes exceeds ${NATIVE_MAX_BYTES} (8 MiB)`,
    );
  }
  if (webBytes > WEB_MAX_BYTES) {
    errors.push(`web kit ${webBytes} bytes exceeds ${WEB_MAX_BYTES} (3 MiB)`);
  }

  return { ok: errors.length === 0, errors, nativeBytes, webBytes };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const result = checkAudioBudget();
  const nativeMb = (result.nativeBytes / (1024 * 1024)).toFixed(3);
  const webMb = (result.webBytes / (1024 * 1024)).toFixed(3);
  console.log(`native=${result.nativeBytes} (${nativeMb} MiB) web=${result.webBytes} (${webMb} MiB)`);
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`error: ${err}`);
    }
    process.exit(1);
  }
  console.log('audio budget ok');
}
