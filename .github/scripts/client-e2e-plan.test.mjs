import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planClientE2e } from './client-e2e-plan.mjs';

const EN_GREP_INVERT = String.raw`\(es\)|locale es|\bES\b`;
const SMOKE_SPECS = [
  'e2e/specs/smoke.spec.ts',
  'e2e/specs/card-front.spec.ts',
  'e2e/specs/laterality-bar.spec.ts',
];
const SMOKE_GREP = 'card renders|short label|grade 3';

describe('planClientE2e', () => {
  it('skips when a PR touches no client or E2E paths', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: false,
      changedFiles: ['README.md', 'app/Models/Concept.php'],
    });
    assert.equal(plan.shouldRun, false);
    assert.equal(plan.mode, 'skip');
    assert.equal(plan.runStability, false);
  });

  it('uses a 390px English subset for a PR that touches a mapped screen', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: true,
      changedFiles: ['apps/client/components/ConceptCard.tsx'],
    });
    assert.equal(plan.shouldRun, true);
    assert.equal(plan.mode, 'subset');
    assert.equal(plan.project, '390x844');
    assert.equal(plan.grepInvert, EN_GREP_INVERT);
    assert.deepEqual(plan.specs, ['e2e/specs/card-back.spec.ts', 'e2e/specs/card-front.spec.ts']);
    assert.equal(plan.grep, '');
    assert.equal(plan.runStability, false);
  });

  it('uses the subset for ready PRs too (draft vs ready does not change the plan)', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: true,
      changedFiles: ['apps/client/components/ConceptCard.tsx'],
      runFull: false,
    });
    assert.equal(plan.mode, 'subset');
    assert.equal(plan.project, '390x844');
    assert.equal(plan.runStability, false);
  });

  it('falls back to the fixed smoke set when PR changes are not mappable to a screen', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: true,
      changedFiles: ['apps/client/e2e/helpers/preparePage.ts', '.github/workflows/client-e2e.yml'],
    });
    assert.equal(plan.mode, 'subset');
    assert.deepEqual(plan.specs, SMOKE_SPECS);
    assert.equal(plan.grep, SMOKE_GREP);
    assert.equal(plan.project, '390x844');
    assert.equal(plan.grepInvert, EN_GREP_INVERT);
  });

  it('does not run Spanish-only specs in the PR subset', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: true,
      changedFiles: ['apps/client/e2e/specs/locale-es.spec.ts'],
    });
    assert.equal(plan.mode, 'subset');
    assert.deepEqual(plan.specs, SMOKE_SPECS);
    assert.equal(plan.grep, SMOKE_GREP);
  });

  it('runs the full 390×844 suite when runFull is set (label trigger)', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: true,
      changedFiles: ['apps/client/components/ConceptCard.tsx'],
      runFull: true,
    });
    assert.equal(plan.shouldRun, true);
    assert.equal(plan.mode, 'full');
    assert.equal(plan.project, '390x844');
    assert.equal(plan.grep, '');
    assert.equal(plan.grepInvert, '');
    assert.deepEqual(plan.specs, []);
    assert.equal(plan.runStability, false);
  });

  it('still skips non-client PRs even when runFull is set', () => {
    const plan = planClientE2e({
      eventName: 'pull_request',
      clientChanged: false,
      changedFiles: ['README.md'],
      runFull: true,
    });
    assert.equal(plan.shouldRun, false);
    assert.equal(plan.mode, 'skip');
  });

  it('runs the full 390×844 suite on push to main', () => {
    const plan = planClientE2e({
      eventName: 'push',
      clientChanged: true,
      changedFiles: ['apps/client/app/index.tsx'],
    });
    assert.equal(plan.mode, 'full');
    assert.equal(plan.project, '390x844');
    assert.equal(plan.runStability, false);
  });

  it('runs the full 390×844 suite on workflow_dispatch', () => {
    const plan = planClientE2e({
      eventName: 'workflow_dispatch',
      clientChanged: true,
      changedFiles: [],
    });
    assert.equal(plan.mode, 'full');
    assert.equal(plan.project, '390x844');
    assert.equal(plan.runStability, false);
  });
});
