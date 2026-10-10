#!/usr/bin/env node
/**
 * On push to main: publish Client E2E captures to orphan branch `e2e-screenshots`
 * under `baselines/` (overwrite). Write-scoped job; expects SCREENSHOTS_DIR artifact
 * only — does not run pnpm / Expo.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORPHAN_BRANCH = 'e2e-screenshots';
const BASELINES_PREFIX = 'baselines';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
  SCREENSHOTS_DIR,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !SCREENSHOTS_DIR) {
  console.log('Missing env; skip baseline publish.');
  process.exit(0);
}

const src = path.resolve(SCREENSHOTS_DIR);
if (!fs.existsSync(src)) {
  console.log('SCREENSHOTS_DIR missing; skip baseline publish:', src);
  process.exit(0);
}

const pngs = fs.readdirSync(src).filter((f) => f.endsWith('.png'));
if (!pngs.length) {
  console.log('No screenshots to publish as baselines.');
  process.exit(0);
}

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-baselines-'));
const remote = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
const shortSha = (GITHUB_SHA || 'unknown').slice(0, 12);

sh('git init', work);
sh('git config user.name "github-actions[bot]"', work);
sh('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"', work);

let hasRemoteBranch = false;
try {
  sh(`git fetch --depth=1 ${remote} ${ORPHAN_BRANCH}`, work);
  sh(`git checkout -b ${ORPHAN_BRANCH} FETCH_HEAD`, work);
  hasRemoteBranch = true;
} catch {
  sh(`git checkout --orphan ${ORPHAN_BRANCH}`, work);
}

const dest = path.join(work, BASELINES_PREFIX);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

for (const file of pngs) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

sh('git add -A', work);
try {
  sh(`git commit -m "e2e baselines ${shortSha}"`, work);
} catch {
  console.log('Baselines unchanged on orphan branch.');
  process.exit(0);
}

if (hasRemoteBranch) sh(`git push ${remote} HEAD:${ORPHAN_BRANCH}`, work);
else sh(`git push -u ${remote} HEAD:${ORPHAN_BRANCH}`, work);

console.log(`Published ${pngs.length} baselines to ${ORPHAN_BRANCH}:${BASELINES_PREFIX}/`);
