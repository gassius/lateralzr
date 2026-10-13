#!/usr/bin/env node
/**
 * Decide Client E2E skip / PR-subset / full run from changed paths + event.
 * Used by .github/workflows/client-e2e.yml so the required check always reports.
 *
 * Pull requests always use the 390px EN subset (draft vs ready does not matter).
 * Full run (single 390×844 project): push, workflow_dispatch, or runFull (label).
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const EN_GREP_INVERT = String.raw`\(es\)|locale es|\bES\b`;
export const SMOKE_SPECS = [
  'e2e/specs/smoke.spec.ts',
  'e2e/specs/card-front.spec.ts',
  'e2e/specs/laterality-bar.spec.ts',
];
export const SMOKE_GREP = 'card renders|short label|grade 3';

/** @typedef {{ spec: string, match: RegExp }} ScreenRule */

/** @type {ScreenRule[]} */
const SCREEN_RULES = [
  {
    spec: 'e2e/specs/card-front.spec.ts',
    match: /e2e\/specs\/card-front\.spec\.ts$|components\/ConceptCard(\.tsx|Stack)|components\/ComplexityCue/,
  },
  {
    spec: 'e2e/specs/card-back.spec.ts',
    match: /e2e\/specs\/card-back\.spec\.ts$|components\/ConceptCard\.tsx$/,
  },
  {
    spec: 'e2e/specs/laterality-bar.spec.ts',
    match: /laterality-bar\.spec|LateralityControl/,
  },
  {
    spec: 'e2e/specs/laterality-sheet.spec.ts',
    match: /laterality-sheet\.spec|LateralitySheet/,
  },
  {
    spec: 'e2e/specs/app-menu.spec.ts',
    match: /app-menu\.spec|AppMenu/,
  },
  {
    spec: 'e2e/specs/status.spec.ts',
    match: /status\.spec|LoadingCard|DeckStatus|useConnectivity/,
  },
  {
    spec: 'e2e/specs/logo.spec.ts',
    match: /logo\.spec|LateralzrLogo/,
  },
  {
    spec: 'e2e/specs/typography.spec.ts',
    match: /typography\.spec|theme\//,
  },
  {
    spec: 'e2e/specs/card-pattern.spec.ts',
    match: /card-pattern\.spec|PatternLayer|assets\/images\/pattern/,
  },
  {
    spec: 'e2e/specs/card-pulse.spec.ts',
    match: /card-pulse\.spec|useConnectorPulse|connectorPulse|e2eFlags|PatternLayer/,
  },
  {
    spec: 'e2e/specs/keyboard-a11y.spec.ts',
    match: /keyboard-a11y\.spec|AccessibleNavRow/,
  },
  {
    spec: 'e2e/specs/locale-es.spec.ts',
    match: /locale-es\.spec/,
  },
  {
    spec: 'e2e/specs/smoke.spec.ts',
    match: /smoke\.spec/,
  },
];

const SUBSET_SKIP_SPECS = new Set(['e2e/specs/locale-es.spec.ts']);

/**
 * @param {{
 *   eventName: string,
 *   clientChanged: boolean,
 *   changedFiles: string[],
 *   runFull?: boolean,
 * }} input
 */
export function planClientE2e(input) {
  const eventName = input.eventName || '';
  const isPr = eventName === 'pull_request';
  const runFull = Boolean(input.runFull);

  if (isPr && !input.clientChanged) {
    return {
      shouldRun: false,
      mode: 'skip',
      project: '',
      grep: '',
      grepInvert: '',
      specs: [],
      runStability: false,
    };
  }

  if (!isPr || runFull) {
    return {
      shouldRun: true,
      mode: 'full',
      project: '390x844',
      grep: '',
      grepInvert: '',
      specs: [],
      runStability: false,
    };
  }

  const files = Array.isArray(input.changedFiles) ? input.changedFiles : [];
  const mapped = [...new Set(
    SCREEN_RULES
      .filter((rule) => files.some((file) => rule.match.test(file)))
      .map((rule) => rule.spec)
      .filter((spec) => !SUBSET_SKIP_SPECS.has(spec)),
  )].sort();

  const useSmoke = mapped.length === 0;

  return {
    shouldRun: true,
    mode: 'subset',
    project: '390x844',
    grep: useSmoke ? SMOKE_GREP : '',
    grepInvert: EN_GREP_INVERT,
    specs: useSmoke ? [...SMOKE_SPECS] : mapped,
    runStability: false,
  };
}

function parseChangedFiles(raw) {
  if (!raw || raw === '[]') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(/\s+/).filter(Boolean);
  }
}

function writeGitHubOutput(plan) {
  const dest = process.env.GITHUB_OUTPUT;
  const lines = [
    `should_run=${plan.shouldRun ? 'true' : 'false'}`,
    `mode=${plan.mode}`,
    `project=${plan.project}`,
    `grep=${plan.grep}`,
    `grep_invert=${plan.grepInvert}`,
    `specs=${plan.specs.join(' ')}`,
    `run_stability=${plan.runStability ? 'true' : 'false'}`,
  ];
  const body = `${lines.join('\n')}\n`;
  if (dest) {
    fs.appendFileSync(dest, body);
  }
  for (const line of lines) {
    console.log(line);
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const plan = planClientE2e({
    eventName: process.env.EVENT_NAME || '',
    clientChanged: process.env.CLIENT_CHANGED === 'true',
    changedFiles: parseChangedFiles(process.env.CLIENT_FILES || ''),
    runFull: process.env.RUN_FULL === 'true',
  });
  writeGitHubOutput(plan);
}
