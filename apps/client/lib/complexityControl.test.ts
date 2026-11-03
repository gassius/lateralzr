import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setActiveLocale } from './i18n.ts';
import {
  clampComplexityGrade,
  complexityA11yText,
  complexityBarLabel,
  complexityCommitFromRail,
  complexityNextFromControlInput,
  complexityStepFromX,
} from './complexityControl.ts';

describe('complexityControl (Lz-67)', () => {
  it('clamps and maps rail x like Laterality', () => {
    assert.equal(clampComplexityGrade(0), 1);
    assert.equal(clampComplexityGrade(9), 5);
    assert.equal(complexityStepFromX(0, 100), 1);
    assert.equal(complexityStepFromX(99, 100), 5);
    assert.equal(complexityCommitFromRail(50, 100), 3);
    assert.equal(complexityCommitFromRail(50, 100, { swapping: true }), null);
  });

  it('steps from a11y actions', () => {
    assert.equal(complexityNextFromControlInput(2, 'increment'), 3);
    assert.equal(complexityNextFromControlInput(2, 'decrement'), 1);
    assert.equal(complexityNextFromControlInput(5, 'increment'), null);
  });

  it('localizes the bar label and a11y value', () => {
    setActiveLocale('en');
    assert.equal(complexityBarLabel(2), 'Complexity 2');
    assert.equal(complexityA11yText(2), 'Complexity, 2 of 5');
    setActiveLocale('es');
    assert.equal(complexityBarLabel(2), 'Complejidad 2');
    assert.equal(complexityA11yText(2), 'Complejidad, 2 de 5');
    setActiveLocale('en');
  });
});
