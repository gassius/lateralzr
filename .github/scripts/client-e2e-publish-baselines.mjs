#!/usr/bin/env node
/**
 * On push to main: copy Client E2E captures into apps/client/e2e/baselines/ and commit.
 * Runs only in the write-scoped baselines job after the read-only test job.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
  SCREENSHOTS_DIR,
  BASELINES_DIR = 'apps/client/e2e/baselines',
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !SCREENSHOTS_DIR) {
  console.log('Missing env; skip baseline publish.');
  process.exit(0);
}

const src = path.resolve(SCREENSHOTS_DIR);
const dest = path.resolve(BASELINES_DIR);
fs.mkdirSync(dest, { recursive: true });

const pngs = fs.readdirSync(src).filter((f) => f.endsWith('.png'));
if (!pngs.length) {
  console.log('No screenshots to publish as baselines.');
  process.exit(0);
}

for (const file of pngs) {
  // Skip intentional non-capture files if any
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

execSync('git config user.name "github-actions[bot]"');
execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
execSync(`git add ${BASELINES_DIR}`);
try {
  execSync(
    `git commit -m "chore(client-e2e): publish screenshot baselines from ${GITHUB_SHA.slice(0, 12)}"`,
  );
} catch {
  console.log('Baselines unchanged.');
  process.exit(0);
}

const remote = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;
execSync(`git push ${remote} HEAD:${process.env.GITHUB_REF_NAME || 'main'}`, {
  stdio: 'inherit',
});
console.log('Published baselines to', BASELINES_DIR);
