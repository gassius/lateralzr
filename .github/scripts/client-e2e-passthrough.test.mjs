import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyKind,
  classifyKindFromJobSteps,
  classifyKindFromSummary,
  isSelfCheckRun,
  listCaptureCandidates,
  selectCaptureMirrorTarget,
  stepActivelyRan,
} from './client-e2e-passthrough.mjs';

describe('isSelfCheckRun', () => {
  it('excludes the current check run by id even when URLs are empty', () => {
    assert.equal(
      isSelfCheckRun(
        { id: 114910735389, details_url: null, html_url: null },
        { runId: '38278788448', checkRunId: '114910735389' },
      ),
      true,
    );
  });

  it('excludes by GITHUB_RUN_ID in details_url', () => {
    assert.equal(
      isSelfCheckRun(
        {
          id: 999,
          details_url: 'https://github.com/o/r/actions/runs/38278788448/job/999',
          html_url: null,
        },
        { runId: '38278788448', checkRunId: '' },
      ),
      true,
    );
  });

  it('does not exclude an earlier capture run on the same head SHA', () => {
    assert.equal(
      isSelfCheckRun(
        {
          id: 114909883534,
          details_url: 'https://github.com/o/r/actions/runs/38278534673/job/114909883534',
          html_url: 'https://github.com/o/r/actions/runs/38278534673/job/114909883534',
        },
        { runId: '38278788448', checkRunId: '114910735389' },
      ),
      false,
    );
  });

  it('does not treat empty run id as a universal match', () => {
    assert.equal(
      isSelfCheckRun(
        {
          id: 1,
          details_url: 'https://github.com/o/r/actions/runs/38278534673/job/1',
        },
        { runId: '', checkRunId: '' },
      ),
      false,
    );
  });
});

describe('listCaptureCandidates', () => {
  it('drops self and returns newest remaining first', () => {
    const self = { runId: '100', checkRunId: '10' };
    const runs = [
      {
        id: 10,
        started_at: '2026-10-12T16:38:27Z',
        details_url: 'https://github.com/o/r/actions/runs/100/job/10',
      },
      {
        id: 9,
        started_at: '2026-10-12T16:36:15Z',
        details_url: 'https://github.com/o/r/actions/runs/99/job/9',
      },
      {
        id: 8,
        started_at: '2026-10-12T16:30:00Z',
        details_url: null,
        html_url: null,
      },
    ];
    const ids = listCaptureCandidates(runs, self).map((r) => r.id);
    assert.deepEqual(ids, [9, 8]);
  });

  it('excludes self by checkRunId when details_url is missing (hang root cause)', () => {
    const self = { runId: '100', checkRunId: '10' };
    const runs = [
      { id: 10, started_at: '2026-10-12T16:38:27Z', details_url: null, html_url: null },
      {
        id: 9,
        started_at: '2026-10-12T16:36:15Z',
        details_url: 'https://github.com/o/r/actions/runs/99/job/9',
      },
    ];
    const ids = listCaptureCandidates(runs, self).map((r) => r.id);
    assert.deepEqual(ids, [9]);
  });
});

describe('stepActivelyRan / classifyKind', () => {
  it('treats skipped and pending steps as inactive', () => {
    assert.equal(stepActivelyRan({ name: 'x', conclusion: 'skipped', status: 'completed' }), false);
    assert.equal(stepActivelyRan({ name: 'x', status: 'pending', conclusion: null }), false);
    assert.equal(stepActivelyRan({ name: 'x', status: 'in_progress', conclusion: null }), true);
    assert.equal(stepActivelyRan({ name: 'x', status: 'completed', conclusion: 'success' }), true);
  });

  it('does not classify capture as passthrough when Pass-through step is skipped', () => {
    const captureSteps = [
      { name: 'Pass-through required check', status: 'completed', conclusion: 'skipped' },
      { name: 'Mark capture run', status: 'completed', conclusion: 'success' },
      { name: 'Plan E2E tier', status: 'completed', conclusion: 'success' },
    ];
    assert.equal(classifyKindFromJobSteps(captureSteps), 'capture');
    assert.equal(classifyKind({ steps: captureSteps, summary: null }), 'capture');
  });

  it('classifies in-progress pass-through even when Mark capture is still pending', () => {
    const passthroughSteps = [
      { name: 'Pass-through required check', status: 'in_progress', conclusion: null },
      { name: 'Mark capture run', status: 'pending', conclusion: null },
      { name: 'Plan E2E tier', status: 'pending', conclusion: null },
    ];
    assert.equal(classifyKindFromJobSteps(passthroughSteps), 'passthrough');
  });

  it('classifies completed pass-through when Mark capture stayed skipped', () => {
    assert.equal(
      classifyKindFromJobSteps([
        { name: 'Pass-through required check', status: 'completed', conclusion: 'success' },
        { name: 'Mark capture run', status: 'completed', conclusion: 'skipped' },
      ]),
      'passthrough',
    );
  });

  it('prefers summary markers over ambiguous steps', () => {
    assert.equal(
      classifyKind({
        summary: '<!-- client-e2e-mode:capture -->',
        steps: [{ name: 'Pass-through required check', status: 'in_progress' }],
      }),
      'capture',
    );
    assert.equal(
      classifyKindFromSummary('<!-- client-e2e-mode:passthrough -->\n'),
      'passthrough',
    );
  });

  it('returns unknown when no active identifying steps exist', () => {
    assert.equal(classifyKindFromJobSteps([]), 'unknown');
    assert.equal(
      classifyKindFromJobSteps([
        { name: 'Pass-through required check', status: 'pending', conclusion: null },
        { name: 'Mark capture run', status: 'pending', conclusion: null },
      ]),
      'unknown',
    );
  });
});

describe('selectCaptureMirrorTarget', () => {
  it('returns success immediately when a completed capture exists among pass-through noise', () => {
    const target = selectCaptureMirrorTarget([
      {
        id: 1,
        kind: 'passthrough',
        status: 'in_progress',
        conclusion: null,
      },
      {
        id: 2,
        kind: 'unknown',
        status: 'queued',
        conclusion: null,
      },
      {
        id: 3,
        kind: 'capture',
        status: 'completed',
        conclusion: 'success',
      },
      {
        id: 4,
        kind: 'passthrough',
        status: 'in_progress',
        conclusion: null,
      },
    ]);
    assert.deepEqual(target, {
      action: 'success',
      id: 3,
      status: 'completed',
      conclusion: 'success',
    });
  });

  it('ignores every pass-through and never waits on unknown', () => {
    const target = selectCaptureMirrorTarget([
      { id: 10, kind: 'passthrough', status: 'in_progress', conclusion: null },
      { id: 11, kind: 'unknown', status: 'in_progress', conclusion: null },
      { id: 12, kind: 'passthrough', status: 'queued', conclusion: null },
    ]);
    assert.deepEqual(target, { action: 'none' });
  });

  it('waits only on an in-progress capture when none completed yet', () => {
    const target = selectCaptureMirrorTarget([
      { id: 1, kind: 'passthrough', status: 'in_progress', conclusion: null },
      { id: 2, kind: 'capture', status: 'in_progress', conclusion: null },
    ]);
    assert.deepEqual(target, {
      action: 'wait',
      id: 2,
      status: 'in_progress',
      conclusion: null,
    });
  });

  it('mirrors capture failure', () => {
    const target = selectCaptureMirrorTarget([
      { id: 9, kind: 'capture', status: 'completed', conclusion: 'failure' },
    ]);
    assert.equal(target.action, 'failure');
    assert.equal(target.conclusion, 'failure');
  });

  it('prefers completed success over a newer in-progress capture', () => {
    const target = selectCaptureMirrorTarget([
      { id: 5, kind: 'capture', status: 'in_progress', conclusion: null },
      { id: 4, kind: 'capture', status: 'completed', conclusion: 'success' },
    ]);
    assert.deepEqual(target, {
      action: 'success',
      id: 4,
      status: 'completed',
      conclusion: 'success',
    });
  });
});
