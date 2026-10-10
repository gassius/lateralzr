#!/usr/bin/env node
/**
 * On pull_request closed: remove `pr-<number>/` from orphan branch `e2e-screenshots`.
 * Write-scoped; no checkout of the PR tree / no pnpm.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORPHAN_BRANCH = 'e2e-screenshots';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_PATH } = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH) {
  console.log('Missing env; skip cleanup.');
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
const pr = event.pull_request;
if (!pr || event.action !== 'closed') {
  console.log('Not a closed pull_request; skip.');
  process.exit(0);
}

const prDirName = `pr-${pr.number}`;

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-cleanup-'));
const remote = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;

sh('git init', work);
sh('git config user.name "github-actions[bot]"', work);
sh('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"', work);

try {
  sh(`git fetch --depth=1 ${remote} ${ORPHAN_BRANCH}`, work);
  sh(`git checkout -b ${ORPHAN_BRANCH} FETCH_HEAD`, work);
} catch {
  console.log(`Orphan branch ${ORPHAN_BRANCH} missing; nothing to clean.`);
  process.exit(0);
}

const dest = path.join(work, prDirName);
const legacy = path.join(work, 'pr', String(pr.number));
let removed = false;
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
  removed = true;
}
if (fs.existsSync(legacy)) {
  fs.rmSync(legacy, { recursive: true, force: true });
  removed = true;
}

if (!removed) {
  console.log(`No ${prDirName}/ (or legacy) folder on orphan branch.`);
  process.exit(0);
}

sh('git add -A', work);
try {
  sh(`git commit -m "chore(e2e): remove ${prDirName} after PR #${pr.number} closed"`, work);
} catch {
  console.log('Nothing to commit after cleanup.');
  process.exit(0);
}

sh(`git push ${remote} HEAD:${ORPHAN_BRANCH}`, work);
console.log(`Removed ${prDirName}/ from ${ORPHAN_BRANCH}.`);
