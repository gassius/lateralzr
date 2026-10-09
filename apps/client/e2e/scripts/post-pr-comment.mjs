#!/usr/bin/env node
/**
 * Post or update a single sticky PR comment with primary 390×844 screenshots.
 * Pushes images to the orphan `e2e-screenshots` branch so they embed inline.
 * Fork PRs: artifact link only (no orphan push / no embeds).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.join(HERE, '..', 'screenshots');
const MARKER = '<!-- lateralzr-client-e2e-screenshots -->';
const ORPHAN_BRANCH = 'e2e-screenshots';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
  GITHUB_RUN_ID,
  GITHUB_SERVER_URL = 'https://github.com',
  GITHUB_EVENT_PATH,
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH) {
  console.log('Missing GitHub env; skip PR comment.');
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
const pr = event.pull_request;
if (!pr) {
  console.log('Not a pull_request event; skip PR comment.');
  process.exit(0);
}

const isFork = Boolean(pr.head?.repo?.full_name && pr.head.repo.full_name !== GITHUB_REPOSITORY);
const [owner, repo] = GITHUB_REPOSITORY.split('/');
const artifactUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
const primaryDir = path.join(SCREENSHOTS, '390x844');
const shortSha = GITHUB_SHA.slice(0, 12);

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
    const text = await res.text();
    throw new Error(`GitHub API ${pathname} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

function pushOrphanScreenshots(files) {
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

  for (const vp of ['390x844', '320x568', '1280x800']) {
    const src = path.join(SCREENSHOTS, vp);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destRoot, vp);
    fs.mkdirSync(dest, { recursive: true });
    for (const file of listPngs(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
  }

  const diffs = path.join(SCREENSHOTS, 'diffs');
  if (fs.existsSync(diffs)) {
    fs.cpSync(diffs, path.join(destRoot, 'diffs'), { recursive: true });
  }

  sh('git add .', work);
  try {
    sh(
      `git commit -m "e2e screenshots PR #${pr.number} ${shortSha}"`,
      work,
    );
  } catch {
    console.log('No screenshot changes to commit on orphan branch.');
  }

  // Orphan branch is screenshot hosting only (not a product branch).
  if (hasRemoteBranch) {
    sh(`git push ${remote} HEAD:${ORPHAN_BRANCH}`, work);
  } else {
    sh(`git push -u ${remote} HEAD:${ORPHAN_BRANCH}`, work);
  }

  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ORPHAN_BRANCH}/pr/${pr.number}/${shortSha}/390x844`;
  return files.map((f) => ({ name: f, url: `${base}/${f}` }));
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
    '- Artifact: download **client-e2e-screenshots** from the run (all viewports + HTML report)',
    '- Baseline diffs: **report-only** until Critiquito approves baselines (`E2E_STRICT_BASELINES=1` to fail)',
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

  const diffNotes = path.join(SCREENSHOTS, 'diffs');
  if (fs.existsSync(diffNotes)) {
    const notes = fs.readdirSync(diffNotes).filter((f) => f.endsWith('.txt'));
    if (notes.length) {
      lines.push('#### Baseline diff notes (report-only)', '');
      for (const n of notes.slice(0, 20)) {
        lines.push(`- \`${n}\``);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

const primary = listPngs(primaryDir);
let embeds = [];
if (!isFork && primary.length) {
  try {
    embeds = pushOrphanScreenshots(primary);
  } catch (err) {
    console.warn('Orphan branch push failed; falling back to artifact link only.', err);
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
