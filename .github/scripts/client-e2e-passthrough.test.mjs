import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyKindFromJobSteps,
  classifyKindFromSummary,
  isSelfCheckRun,
  listCaptureCandidates,
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
    // id 8 has empty URLs but is not self by checkRunId/runId → kept
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

describe('classifyKind', () => {
  it('classifies capture and passthrough from steps and summary', () => {
    assert.equal(
      classifyKindFromJobSteps([{ name: 'Pass-through required check' }]),
      'passthrough',
    );
    assert.equal(classifyKindFromJobSteps([{ name: 'Mark capture run' }]), 'capture');
    assert.equal(classifyKindFromJobSteps([{ name: 'Plan E2E tier' }]), 'capture');
    assert.equal(classifyKindFromJobSteps([]), 'unknown');
    assert.equal(
      classifyKindFromSummary('<!-- client-e2e-mode:passthrough -->\n'),
      'passthrough',
    );
    assert.equal(classifyKindFromSummary('<!-- client-e2e-mode:capture -->'), 'capture');
  });
});
