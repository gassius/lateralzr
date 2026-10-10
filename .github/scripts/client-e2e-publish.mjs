#!/usr/bin/env node
/**
 * Privileged Client E2E publisher — runs ONLY in the write-scoped CI job.
 * Expects SCREENSHOTS_DIR to point at the downloaded artifact screenshots folder.
 * Does not install deps or execute the Expo app.
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
const shortSha = GITHUB_SHA.slice(0, 12);

function listPngs(dir, recursive = false) {
  if (!fs.existsSync(dir)) return [];
  if (!recursive) {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.png'))
      .sort();
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPngs(full, true).map((f) => path.join(entry.name, f)));
    else if (entry.name.endsWith('.png')) out.push(entry.name);
  }
  return out.sort();
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

function pushOrphan(primaryFiles) {
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

  const destRoot = path.join(work, 'pr', String(pr.number), shortSha);
  fs.rmSync(destRoot, { recursive: true, force: true });
  fs.mkdirSync(destRoot, { recursive: true });

  for (const file of listPngs(SCREENSHOTS)) {
    fs.copyFileSync(path.join(SCREENSHOTS, file), path.join(destRoot, file));
  }
  const diffs = path.join(SCREENSHOTS, 'diffs');
  if (fs.existsSync(diffs)) {
    fs.cpSync(diffs, path.join(destRoot, 'diffs'), { recursive: true });
  }

  sh('git add .', work);
  try {
    sh(`git commit -m "e2e screenshots PR #${pr.number} ${shortSha}"`, work);
  } catch {
    console.log('No screenshot changes to commit on orphan branch.');
  }

  if (hasRemoteBranch) sh(`git push ${remote} HEAD:${ORPHAN_BRANCH}`, work);
  else sh(`git push -u ${remote} HEAD:${ORPHAN_BRANCH}`, work);

  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ORPHAN_BRANCH}/pr/${pr.number}/${shortSha}`;
  return primaryFiles.map((f) => ({ name: f, url: `${base}/${f}` }));
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

function buildBody(embeds) {
  const lines = [
    MARKER,
    '### Agent: GasNet Implementer',
    '',
    '**Client E2E screenshots** (deterministic Expo web export)',
    '',
    `- Run: [actions #${GITHUB_RUN_ID}](${artifactUrl})`,
    `- SHA: \`${shortSha}\``,
    '- Artifact: **client-e2e-screenshots** (captures + `diffs/` + HTML report)',
    '- Baseline diffs: **report-only** (1% threshold) until Critiquito approves; `E2E_STRICT_BASELINES=1` to fail',
    '- Demo seeds (not approved baselines): see `apps/client/e2e/baselines/DEMO-SEEDS.md`',
    '',
  ];

  if (isFork || embeds.length === 0) {
    lines.push('_Fork PR or no primary screenshots — use the workflow artifact._', '');
  } else {
    lines.push('#### Primary viewport 390×844', '');
    for (const { name, url } of embeds) {
      lines.push(`**${name.replace(/\.png$/, '')}**`, '', `![${name}](${url})`, '');
    }
  }

  const summary = loadDiffSummary();
  const diffBase = !isFork
    ? `https://raw.githubusercontent.com/${owner}/${repo}/${ORPHAN_BRANCH}/pr/${pr.number}/${shortSha}/diffs`
    : null;

  if (summary.length) {
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

    const overWithImages = summary.filter((r) => r.diffImage);
    if (overWithImages.length && diffBase) {
      lines.push('#### Diff images', '');
      for (const row of overWithImages) {
        lines.push(`**${row.file}** (${row.percent.toFixed(2)}%)`, '', `![${row.diffImage}](${diffBase}/${row.diffImage})`, '');
      }
    }
  }

  return lines.join('\n');
}

const allPngs = listPngs(SCREENSHOTS);
const primary = allPngs.filter((f) => f.includes('_390x844_')).sort();

let embeds = [];
if (!isFork && primary.length) {
  try {
    embeds = pushOrphan(primary);
  } catch (err) {
    console.warn('Orphan branch push failed; artifact link only.', err);
  }
}

const body = buildBody(embeds);
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
