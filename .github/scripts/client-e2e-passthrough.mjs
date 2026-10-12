#!/usr/bin/env node
/**
 * Pass-through helpers for Client E2E screenshots required check.
 *
 * Label/unlabeled runs must mirror only real capture jobs on the head SHA.
 * Every pass-through job is ignored (not only the current run).
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
 * Step is present on the job graph and is not a skipped/pending placeholder.
 * Capture jobs always include a skipped "Pass-through required check" step — that
 * must not count as passthrough.
 *
 * @param {{ name?: string, status?: string|null, conclusion?: string|null }} step
 */
export function stepActivelyRan(step) {
  if (!step || !step.name) return false;
  const status = step.status || '';
  const conclusion = step.conclusion || '';
  if (status === 'pending' || conclusion === 'skipped') return false;
  if (status === 'in_progress' || status === 'queued' || status === 'waiting') return true;
  if (status === 'completed') return true;
  // Some payloads omit status once concluded.
  return Boolean(conclusion) && conclusion !== 'skipped';
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
 * Classify from job steps. Capture must win over a skipped pass-through step.
 *
 * @param {Array<{ name?: string, status?: string|null, conclusion?: string|null }>|null|undefined} steps
 * @returns {'passthrough'|'capture'|'unknown'}
 */
export function classifyKindFromJobSteps(steps) {
  const list = steps || [];
  const active = (name) => list.some((s) => s.name === name && stepActivelyRan(s));

  // Capture markers first: capture jobs list Pass-through as skipped.
  if (active('Mark capture run') || active('Plan E2E tier')) return 'capture';
  if (active('Pass-through required check')) return 'passthrough';
  return 'unknown';
}

/**
 * Merge summary + steps. Explicit summary markers win; otherwise use steps.
 *
 * @param {{ summary?: string|null, steps?: Array<{ name?: string, status?: string|null, conclusion?: string|null }>|null }} info
 * @returns {'passthrough'|'capture'|'unknown'}
 */
export function classifyKind(info = {}) {
  const fromSummary = classifyKindFromSummary(info.summary);
  if (fromSummary !== 'unknown') return fromSummary;
  return classifyKindFromJobSteps(info.steps);
}

/**
 * Newest-first check runs that are not the current pass-through job.
 * Callers must still drop every other pass-through via classifyKind.
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
 * Pick what a pass-through job should do given already-classified candidates
 * (newest-first). Only confirmed capture runs are considered.
 *
 * @param {Array<{ id?: number|string, kind?: string, status?: string|null, conclusion?: string|null }>} classified
 * @returns {{ action: 'success'|'failure'|'wait'|'none', id?: string|number|null, status?: string|null, conclusion?: string|null }}
 */
export function selectCaptureMirrorTarget(classified) {
  const captures = (classified || []).filter((c) => c.kind === 'capture');
  const completedSuccess = captures.find(
    (c) => c.status === 'completed' && c.conclusion === 'success',
  );
  if (completedSuccess) {
    return {
      action: 'success',
      id: completedSuccess.id,
      status: completedSuccess.status,
      conclusion: completedSuccess.conclusion,
    };
  }
  const completedFailure = captures.find(
    (c) => c.status === 'completed' && c.conclusion && c.conclusion !== 'success',
  );
  if (completedFailure) {
    return {
      action: 'failure',
      id: completedFailure.id,
      status: completedFailure.status,
      conclusion: completedFailure.conclusion,
    };
  }
  const inProgress = captures.find(
    (c) =>
      c.status === 'queued' || c.status === 'in_progress' || c.status === 'waiting',
  );
  if (inProgress) {
    return {
      action: 'wait',
      id: inProgress.id,
      status: inProgress.status,
      conclusion: inProgress.conclusion || null,
    };
  }
  return { action: 'none' };
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

  if (command === 'select-mirror-target') {
    // stdin: JSON array of { id, kind, status, conclusion }
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim() || '[]';
    const target = selectCaptureMirrorTarget(JSON.parse(raw));
    console.log(JSON.stringify(target));
    process.exit(0);
  }

  if (command === 'classify-job') {
    // stdin: job JSON (+ optional summary via CLASSIFY_SUMMARY env)
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim() || '{}';
    const job = JSON.parse(raw);
    const kind = classifyKind({
      summary: process.env.CLASSIFY_SUMMARY || '',
      steps: job.steps || [],
    });
    console.log(kind);
    process.exit(0);
  }

  console.error(
    `Usage: ${process.argv[1]} exclude-self-ids|select-mirror-target|classify-job < json`,
  );
  process.exit(2);
}
