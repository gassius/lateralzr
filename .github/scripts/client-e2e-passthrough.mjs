#!/usr/bin/env node
/**
 * Pass-through helpers for Client E2E screenshots required check.
 * Excludes the current workflow run / check-run when selecting a capture to mirror.
 */
import { pathToFileURL } from 'node:url';

/**
 * @param {{ id?: number|string, details_url?: string|null, html_url?: string|null }} checkRun
 * @param {{ runId?: string|number|null, checkRunId?: string|number|null }} self
 */
export function isSelfCheckRun(checkRun, self = {}) {
  const runId = self.runId == null || self.runId === '' ? '' : String(self.runId);
  const checkRunId =
    self.checkRunId == null || self.checkRunId === '' ? '' : String(self.checkRunId);

  if (checkRunId && String(checkRun.id) === checkRunId) {
    return true;
  }

  if (runId) {
    const url = `${checkRun.details_url || ''}\n${checkRun.html_url || ''}`;
    if (url.includes(`/actions/runs/${runId}/`) || url.includes(`/actions/runs/${runId}?`)) {
      return true;
    }
  }

  return false;
}

/**
 * Newest-first check runs that are not the current pass-through job.
 *
 * @param {Array<{ id?: number|string, started_at?: string|null, details_url?: string|null, html_url?: string|null }>} checkRuns
 * @param {{ runId?: string|number|null, checkRunId?: string|number|null }} self
 */
export function listCaptureCandidates(checkRuns, self = {}) {
  return (checkRuns || [])
    .filter((cr) => !isSelfCheckRun(cr, self))
    .slice()
    .sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
}

/**
 * @param {string|null|undefined} summary
 * @returns {'passthrough'|'capture'|'unknown'}
 */
export function classifyKindFromSummary(summary) {
  const text = summary || '';
  if (text.includes('client-e2e-mode:passthrough')) return 'passthrough';
  if (text.includes('client-e2e-mode:capture')) return 'capture';
  return 'unknown';
}

/**
 * @param {Array<{ name?: string }>|null|undefined} steps
 * @returns {'passthrough'|'capture'|'unknown'}
 */
export function classifyKindFromJobSteps(steps) {
  const names = (steps || []).map((s) => s.name);
  if (names.includes('Pass-through required check')) return 'passthrough';
  if (names.includes('Mark capture run') || names.includes('Plan E2E tier')) return 'capture';
  return 'unknown';
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const [command] = process.argv.slice(2);
  if (command === 'exclude-self-ids') {
    // stdin: check_runs JSON array; env: CURRENT_RUN_ID, CURRENT_CHECK_RUN_ID
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim() || '[]';
    const checkRuns = JSON.parse(raw);
    const candidates = listCaptureCandidates(checkRuns, {
      runId: process.env.CURRENT_RUN_ID || process.env.GITHUB_RUN_ID || '',
      checkRunId: process.env.CURRENT_CHECK_RUN_ID || '',
    });
    for (const cr of candidates) {
      if (cr.id != null) console.log(String(cr.id));
    }
    process.exit(0);
  }

  console.error(`Usage: ${process.argv[1]} exclude-self-ids < check-runs.json`);
  process.exit(2);
}
