#!/usr/bin/env node
/**
 * Privileged Client E2E publisher — runs ONLY in the write-scoped CI job.
 * Expects SCREENSHOTS_DIR to point at the downloaded artifact screenshots folder.
 * Does not install deps or execute the Expo app / PR tree.
 *
 * Layout on orphan branch `e2e-screenshots` (overwrite each run):
 *   pr-<number>/<screen>_<state>_<viewport>_<locale>.png
 *   pr-<number>/diffs/...
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MARKER = '<!-- lateralzr-client-e2e-screenshots -->';
const ORPHAN_BRANCH = 'e2e-screenshots';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
  GITHUB_RUN_ID,
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_EVENT_PATH,
  SCREENSHOTS_DIR,
  ARTIFACT_HEAD_SHA: ARTIFACT_HEAD_SHA_ENV,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH || !SCREENSHOTS_DIR) {
  console.log('Missing env (TOKEN/REPO/EVENT/SCREENSHOTS_DIR); skip publish.');
  process.exit(0);
}

const SCREENSHOTS = path.resolve(SCREENSHOTS_DIR);
console.log('SCREENSHOTS_DIR resolves to', SCREENSHOTS, 'exists=', fs.existsSync(SCREENSHOTS));
if (fs.existsSync(SCREENSHOTS)) {
  console.log(
    'png count',
    fs.readdirSync(SCREENSHOTS).filter((f) => f.endsWith('.png')).length,
  );
}

const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
const pr = event.pull_request;
if (!pr) {
  console.log('Not a pull_request event; skip.');
  process.exit(0);
}

const isFork = Boolean(pr.head?.repo?.full_name && pr.head.repo.full_name !== GITHUB_REPOSITORY);
const [owner, repo] = GITHUB_REPOSITORY.split('/');
const artifactUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const prDirName = `pr-${pr.number}`;
const treeUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/tree/${ORPHAN_BRANCH}/${prDirName}`;
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${ORPHAN_BRANCH}/${prDirName}`;

/** Tip stamped into the downloaded artifact — never trust workflow-run github.sha alone. */
function readArtifactHeadSha() {
  const fromEnv = (ARTIFACT_HEAD_SHA_ENV || '').trim();
  if (fromEnv) return fromEnv;
  const shaFile = path.join(path.dirname(SCREENSHOTS), 'artifact-head-sha.txt');
  if (fs.existsSync(shaFile)) {
    return fs.readFileSync(shaFile, 'utf8').trim();
  }
  return '';
}

const artifactHeadSha = readArtifactHeadSha();
const shortSha = (artifactHeadSha || GITHUB_SHA || 'unknown').slice(0, 12);

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
}

async function gh(pathname, init = {}) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${pathname} → ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

async function assertArtifactMatchesCurrentHead(phase) {
  if (!artifactHeadSha) {
    throw new Error(
      `${phase}: artifact-head-sha missing (env ARTIFACT_HEAD_SHA or artifact-head-sha.txt); refuse publish`,
    );
  }
  const livePr = await gh(`/repos/${owner}/${repo}/pulls/${pr.number}`);
  const currentHeadSha = livePr?.head?.sha;
  if (!currentHeadSha) {
    throw new Error(`${phase}: could not resolve current head SHA for PR #${pr.number}`);
  }
  if (artifactHeadSha !== currentHeadSha) {
    console.log(
      `${phase}: stale — artifact ${artifactHeadSha} != current PR head ${currentHeadSha}; skip.`,
    );
    return false;
  }
  return true;
}

// Publish-time guard: artifact tip vs live API head (not workflow-run SHA).
if (!(await assertArtifactMatchesCurrentHead('pre-publish'))) {
  process.exit(0);
}

async function pushOrphan() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-shots-'));
  const remote = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git`;

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

  // Fixed path: pr-<number>/ (overwrite). Drop legacy pr/<number>/<sha>/ if present.
  const destRoot = path.join(work, prDirName);
  fs.rmSync(destRoot, { recursive: true, force: true });
  const legacyNested = path.join(work, 'pr', String(pr.number));
  if (fs.existsSync(legacyNested)) {
    fs.rmSync(legacyNested, { recursive: true, force: true });
  }
  fs.mkdirSync(destRoot, { recursive: true });

  for (const file of listPngs(SCREENSHOTS)) {
    fs.copyFileSync(path.join(SCREENSHOTS, file), path.join(destRoot, file));
  }
  const diffs = path.join(SCREENSHOTS, 'diffs');
  if (fs.existsSync(diffs)) {
    fs.cpSync(diffs, path.join(destRoot, 'diffs'), { recursive: true });
  }

  sh('git add -A', work);
  try {
    sh(`git commit -m "e2e screenshots ${prDirName} ${shortSha}"`, work);
  } catch {
    console.log('No screenshot changes to commit on orphan branch.');
  }

  // Re-check immediately before push so a tip move during staging does not write.
  // Do not cancel an in-flight git push; skip only when we have not pushed yet.
  if (!(await assertArtifactMatchesCurrentHead('pre-push'))) {
    return false;
  }

  if (hasRemoteBranch) sh(`git push ${remote} HEAD:${ORPHAN_BRANCH}`, work);
  else sh(`git push -u ${remote} HEAD:${ORPHAN_BRANCH}`, work);

  return true;
}

function loadDiffSummary() {
  const summaryPath = path.join(SCREENSHOTS, 'diffs', 'summary.json');
  if (!fs.existsSync(summaryPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return [];
  }
}

function buildBody(published) {
  const lines = [
    MARKER,
    '### Agent: GasNet Implementer',
    '',
    '**Client E2E screenshots** (deterministic Expo web export)',
    '',
    `- Run: [actions #${GITHUB_RUN_ID}](${artifactUrl})`,
    `- SHA: \`${shortSha}\``,
    published
      ? `- Screenshots: [\`${ORPHAN_BRANCH}:${prDirName}/\`](${treeUrl})`
      : '- Screenshots: _(orphan publish skipped — use workflow artifact)_',
    '- Baseline diffs: **report-only** (1% threshold); `E2E_STRICT_BASELINES=1` to fail',
    '',
  ];

  const summary = loadDiffSummary();
  if (summary.length) {
    const diffBase = published ? `${rawBase}/diffs` : null;
    lines.push('#### Baseline diff summary (report-only)', '');
    lines.push('| Screen | % changed | Result | Diff |');
    lines.push('| --- | ---: | --- | --- |');
    for (const row of summary) {
      const pct = typeof row.percent === 'number' ? row.percent.toFixed(2) : '?';
      const result =
        row.status === 'pass'
          ? 'pass'
          : row.status === 'over-threshold'
            ? 'over-threshold'
            : row.status;
      let diffCell = '—';
      if (row.diffImage && diffBase) {
        diffCell = `[diff](${diffBase}/${row.diffImage})`;
      } else if (row.status === 'size-mismatch') {
        diffCell = 'size-mismatch';
      }
      lines.push(`| \`${row.file}\` | ${pct}% | ${result} | ${diffCell} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

let published = false;
if (!isFork && fs.existsSync(SCREENSHOTS) && listPngs(SCREENSHOTS).length) {
  try {
    published = await pushOrphan();
    // Tip moved after staging: do not overwrite a newer sticky comment.
    if (!published) {
      console.log('Orphan publish skipped after pre-push guard; leave sticky comment unchanged.');
      process.exit(0);
    }
  } catch (err) {
    console.warn('Orphan branch push failed; comment without tree link.', err);
  }
} else if (isFork) {
  console.log('Fork PR: skip orphan publish (no write to base repo branch).');
}

const body = buildBody(published);
const comments = await gh(`/repos/${owner}/${repo}/issues/${pr.number}/comments?per_page=100`);
const existing = Array.isArray(comments)
  ? comments.find((c) => typeof c.body === 'string' && c.body.includes(MARKER))
  : null;

if (existing) {
  await gh(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  console.log('Updated sticky PR comment', existing.id);
} else {
  await gh(`/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  console.log('Created sticky PR comment');
}
