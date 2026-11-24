#!/usr/bin/env node
/**
 * Map changed files → web preview screen ids for cheap Expo web stills.
 * Not native acceptance — Chromium phone-frame only.
 *
 * Usage:
 *   node scripts/web-preview-capture/map-changed-screens.mjs [file...]
 *   git diff --name-only origin/main...HEAD | node scripts/web-preview-capture/map-changed-screens.mjs
 *
 * Prints comma-separated screen ids (CardFront default when UI touched
 * but no finer mapping matches).
 */
import path from 'node:path';
import { createInterface } from 'node:readline';

/** Full design-preview set when capture tooling changes. */
export const ALL_SCREENS = ['CardFront', 'CardBack', 'LateralityBar', 'AppMenu'];

/** Capture tooling / workflow → prove every mapped screen on web. */
const CAPTURE_TOOLING_RE =
  /(^|\/)scripts\/web-preview-capture\/|(^|\/)\.github\/workflows\/web-preview-screenshots\.yml$/;

/** @type {ReadonlyArray<{ re: RegExp, screens: readonly string[] }>} */
const RULES = [
  {
    re: /e2e\/specs\/card-back\.spec\.ts$|components\/ConceptCard(\.tsx|Stack)/,
    screens: ['CardFront', 'CardBack'],
  },
  {
    re: /e2e\/specs\/card-front\.spec\.ts$|components\/ComplexityCue/,
    screens: ['CardFront'],
  },
  {
    re: /laterality-bar\.spec|LateralityControl|laterality-sheet\.spec|LateralitySheet/,
    screens: ['LateralityBar'],
  },
  {
    re: /app-menu\.spec|AppMenu/,
    screens: ['AppMenu'],
  },
  {
    re: /components\/|app\/|theme\/|hooks\/|lib\//,
    screens: ['CardFront'],
  },
  {
    re: /assets\//,
    screens: ['CardFront'],
  },
];

const DEFAULT_UI_SCREENS = ['CardFront', 'CardBack', 'LateralityBar'];

/**
 * @param {readonly string[]} files
 * @returns {string[]}
 */
export function mapChangedFilesToScreens(files) {
  const trimmed = files.map((f) => f.trim()).filter(Boolean);
  if (trimmed.some((f) => CAPTURE_TOOLING_RE.test(f))) {
    return [...ALL_SCREENS];
  }

  const screens = new Set();
  let touchedClientUi = false;
  for (const f of trimmed) {
    if (
      f.startsWith('apps/client/') &&
      !f.startsWith('apps/client/e2e/') &&
      !f.includes('AGENTS.md') &&
      !f.includes('README.md')
    ) {
      touchedClientUi = true;
    }
    const rel = f.replace(/^apps\/client\//, '');
    for (const rule of RULES) {
      if (rule.re.test(f) || rule.re.test(rel)) {
        for (const s of rule.screens) screens.add(s);
        break;
      }
    }
  }
  if (touchedClientUi && screens.size === 0) {
    for (const s of DEFAULT_UI_SCREENS) screens.add(s);
  }
  if (screens.size === 0) {
    screens.add('CardFront');
  }
  return [...screens];
}

async function readFilesFromArgvOrStdin() {
  const argvFiles = process.argv.slice(2).filter((a) => a && !a.startsWith('-'));
  if (argvFiles.length > 0) return argvFiles;
  if (process.stdin.isTTY) return [];
  const lines = [];
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) lines.push(line);
  return lines;
}

async function main() {
  const files = await readFilesFromArgvOrStdin();
  const screens = mapChangedFilesToScreens(files);
  process.stdout.write(`${screens.join(',')}\n`);
}

const entry = process.argv[1] ? path.basename(process.argv[1]) : '';
const isMain = entry === 'map-changed-screens.mjs';

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
