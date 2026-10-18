import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it } from 'node:test';
import {
  A11Y_FOCUS_RING,
  ACCESSIBLE_NAV_TARGET_PX,
  accessibleNavChromeReserve,
  a11yFocusRingCss,
  buildCardAccessibilityActions,
  canRunCardAction,
  CARD_ACCESSIBILITY_ACTION_DEFS,
  cardActionFromAccessibilityName,
  cardActionFromKey,
  cardSurfaceIsAccessibleButton,
  cardWebTabIndex,
  complexityDirectionForAction,
  isCardActionDisabled,
  keyEstablishesKeyboardModality,
  navButtonA11yProps,
  resolveRunnableAccessibilityAction,
  shouldClearKeyboardModalityOnPointer,
  shouldHandleCardSurfaceKey,
  shouldQueryScreenReaderForNav,
  shouldShowAccessibleNavRow,
} from './cardActions.ts';
import { DEFAULT_LOCALE, messages, setActiveLocale, t } from './i18n.ts';

const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  setActiveLocale(DEFAULT_LOCALE);
});

describe('cardActionFromKey', () => {
  it('maps web arrows / Enter / Space to card actions', () => {
    assert.equal(cardActionFromKey('ArrowRight'), 'next');
    assert.equal(cardActionFromKey('ArrowLeft'), 'previous');
    assert.equal(cardActionFromKey('Enter'), 'flip');
    assert.equal(cardActionFromKey(' '), 'flip');
    assert.equal(cardActionFromKey('Space'), 'flip');
    assert.equal(cardActionFromKey('ArrowUp'), 'complexityUp');
    assert.equal(cardActionFromKey('ArrowDown'), 'complexityDown');
  });

  it('returns null for unrecognized keys', () => {
    assert.equal(cardActionFromKey('Escape'), null);
    assert.equal(cardActionFromKey('a'), null);
    assert.equal(cardActionFromKey('Tab'), null);
  });
});

describe('cardActionFromAccessibilityName', () => {
  it('maps activate / custom names to card actions', () => {
    assert.equal(cardActionFromAccessibilityName('activate'), 'flip');
    assert.equal(cardActionFromAccessibilityName('turn'), 'flip');
    assert.equal(cardActionFromAccessibilityName('next'), 'next');
    assert.equal(cardActionFromAccessibilityName('previous'), 'previous');
    assert.equal(cardActionFromAccessibilityName('complexityUp'), 'complexityUp');
    assert.equal(cardActionFromAccessibilityName('complexityDown'), 'complexityDown');
    assert.equal(cardActionFromAccessibilityName('magicTap'), 'flip');
  });

  it('returns null for unknown action names', () => {
    assert.equal(cardActionFromAccessibilityName('increment'), null);
    assert.equal(cardActionFromAccessibilityName('swipe'), null);
  });
});

describe('canRunCardAction', () => {
  const open = { currentIndex: 2, sheetOpen: false, animating: false, showDeckStatus: false };

  it('allows next / flip / complexity when the deck is interactive', () => {
    assert.equal(canRunCardAction('next', open), true);
    assert.equal(canRunCardAction('flip', open), true);
    assert.equal(canRunCardAction('complexityUp', open), true);
    assert.equal(canRunCardAction('complexityDown', open), true);
    assert.equal(canRunCardAction('previous', open), true);
  });

  it('disables Previous at the start of history', () => {
    assert.equal(canRunCardAction('previous', { ...open, currentIndex: 0 }), false);
    assert.equal(canRunCardAction('next', { ...open, currentIndex: 0 }), true);
  });

  it('blocks all actions while a sheet is open', () => {
    for (const action of ['next', 'previous', 'flip', 'complexityUp', 'complexityDown'] as const) {
      assert.equal(canRunCardAction(action, { ...open, sheetOpen: true }), false);
    }
  });

  it('blocks forward actions on the deck-status card but allows previous', () => {
    assert.equal(canRunCardAction('next', { ...open, animating: true }), false);
    assert.equal(canRunCardAction('flip', { ...open, showDeckStatus: true }), false);
    assert.equal(canRunCardAction('complexityUp', { ...open, showDeckStatus: true }), false);
    assert.equal(canRunCardAction('complexityDown', { ...open, showDeckStatus: true }), false);
    assert.equal(canRunCardAction('next', { ...open, showDeckStatus: true }), false);
    assert.equal(
      canRunCardAction('previous', { showDeckStatus: true, currentIndex: 3 }),
      true,
    );
    assert.equal(
      canRunCardAction('previous', { showDeckStatus: true, currentIndex: 0 }),
      false,
    );
  });
});

describe('isCardActionDisabled / navButtonA11yProps (shared row + runAction gate)', () => {
  const gate = { currentIndex: 3, showDeckStatus: true, sheetOpen: false };

  it('shares one gate: previous enabled on deck status, next disabled', () => {
    assert.equal(isCardActionDisabled('previous', gate), false);
    assert.equal(isCardActionDisabled('next', gate), true);
    const prev = navButtonA11yProps({ action: 'previous', label: 'Previous', gate });
    const next = navButtonA11yProps({ action: 'next', label: 'Next', gate });
    assert.equal(prev.accessibilityRole, 'button');
    assert.equal(prev.accessibilityLabel, 'Previous');
    assert.equal(prev.disabled, false);
    assert.deepEqual(prev.accessibilityState, { disabled: false });
    assert.equal(next.disabled, true);
    assert.deepEqual(next.accessibilityState, { disabled: true });
  });

  it('disables Previous at index 0 with role + label intact', () => {
    const props = navButtonA11yProps({
      action: 'previous',
      label: 'Previous',
      gate: { currentIndex: 0, showDeckStatus: false },
    });
    assert.equal(props.accessibilityRole, 'button');
    assert.equal(props.accessibilityLabel, 'Previous');
    assert.equal(props.disabled, true);
  });
});

describe('resolveRunnableAccessibilityAction (dispatch gate)', () => {
  it('maps names and refuses gated actions', () => {
    const open = { currentIndex: 2, showDeckStatus: false };
    assert.equal(resolveRunnableAccessibilityAction('next', open), 'next');
    assert.equal(resolveRunnableAccessibilityAction('activate', open), 'flip');
    assert.equal(resolveRunnableAccessibilityAction('previous', { currentIndex: 0 }), null);
    assert.equal(
      resolveRunnableAccessibilityAction('next', { currentIndex: 3, showDeckStatus: true }),
      null,
    );
    assert.equal(
      resolveRunnableAccessibilityAction('previous', { currentIndex: 3, showDeckStatus: true }),
      'previous',
    );
    assert.equal(resolveRunnableAccessibilityAction('nope', open), null);
  });
});

describe('card surface a11y helpers', () => {
  it('is a single accessible button only on the unflipped interactive face', () => {
    assert.equal(cardSurfaceIsAccessibleButton({ showDeckStatus: false, flipped: false }), true);
    assert.equal(cardSurfaceIsAccessibleButton({ showDeckStatus: false, flipped: true }), false);
    assert.equal(cardSurfaceIsAccessibleButton({ showDeckStatus: true, flipped: false }), false);
  });

  it('keeps web tabIndex reachable for previous during deck status', () => {
    assert.equal(cardWebTabIndex({ sheetOpen: false, showDeckStatus: false, currentIndex: 0 }), 0);
    assert.equal(cardWebTabIndex({ sheetOpen: true, showDeckStatus: false, currentIndex: 2 }), -1);
    assert.equal(cardWebTabIndex({ sheetOpen: false, showDeckStatus: true, currentIndex: 0 }), -1);
    assert.equal(cardWebTabIndex({ sheetOpen: false, showDeckStatus: true, currentIndex: 3 }), 0);
  });

  it('handles card keys on the surface and contained non-control descendants', () => {
    const el = { id: 'surface' };
    const child = { id: 'link' };
    assert.equal(shouldHandleCardSurfaceKey(el as unknown as EventTarget, el as unknown as EventTarget), true);
    assert.equal(
      shouldHandleCardSurfaceKey(child as unknown as EventTarget, el as unknown as EventTarget),
      false,
    );
    assert.equal(shouldHandleCardSurfaceKey(null, el as unknown as EventTarget), false);

    const wiki = {
      closest: (sel: string) => (sel.includes('wikipedia') ? wiki : null),
    };
    const surface = {
      contains: (node: unknown) => node === wiki || node === heading,
    };
    const heading = { closest: () => null };
    assert.equal(
      shouldHandleCardSurfaceKey(heading as unknown as EventTarget, surface as unknown as EventTarget),
      true,
    );
    assert.equal(
      shouldHandleCardSurfaceKey(wiki as unknown as EventTarget, surface as unknown as EventTarget),
      false,
    );
  });
});

describe('buildCardAccessibilityActions (locale-sensitive labels)', () => {
  it('updates labels when the active locale switches', () => {
    setActiveLocale('en');
    const en = buildCardAccessibilityActions(t);
    assert.equal(en.find((a) => a.name === 'next')?.label, 'Next');
    assert.equal(en.find((a) => a.name === 'activate')?.label, 'Turn');
    setActiveLocale('es');
    const es = buildCardAccessibilityActions(t);
    assert.equal(es.find((a) => a.name === 'next')?.label, 'Siguiente');
    assert.equal(es.find((a) => a.name === 'activate')?.label, 'Girar');
    assert.equal(es.find((a) => a.name === 'previous')?.label, 'Anterior');
  });
});

describe('complexityDirectionForAction', () => {
  it('mirrors vertical swipe directions', () => {
    assert.equal(complexityDirectionForAction('complexityUp'), 'up');
    assert.equal(complexityDirectionForAction('complexityDown'), 'down');
  });
});

describe('shouldShowAccessibleNavRow / web SR gate', () => {
  it('stays hidden for touch users without assistive tech', () => {
    assert.equal(
      shouldShowAccessibleNavRow({ screenReaderEnabled: false, keyboardModality: false }),
      false,
    );
  });

  it('shows for screen reader or keyboard modality', () => {
    assert.equal(
      shouldShowAccessibleNavRow({ screenReaderEnabled: true, keyboardModality: false }),
      true,
    );
    assert.equal(
      shouldShowAccessibleNavRow({ screenReaderEnabled: false, keyboardModality: true }),
      true,
    );
  });

  it('does not query screen reader on web (RN-web always true)', () => {
    assert.equal(shouldQueryScreenReaderForNav('web'), false);
    assert.equal(shouldQueryScreenReaderForNav('ios'), true);
    assert.equal(shouldQueryScreenReaderForNav('android'), true);
  });
});

describe('keyboard modality pointer clear', () => {
  it('keeps modality when pointer lands inside the nav row', () => {
    const inside = { tag: 'button' };
    const row = { contains: (n: Node) => n === (inside as unknown as Node) };
    assert.equal(
      shouldClearKeyboardModalityOnPointer(
        inside as unknown as EventTarget,
        row as unknown as Element,
      ),
      false,
    );
    assert.equal(
      shouldClearKeyboardModalityOnPointer(
        { tag: 'card' } as unknown as EventTarget,
        { contains: () => false } as unknown as Element,
      ),
      true,
    );
    assert.equal(shouldClearKeyboardModalityOnPointer(null, null), true);
  });
});

describe('keyEstablishesKeyboardModality / accessibleNavChromeReserve', () => {
  it('treats Tab / arrows / Enter / Space as keyboard modality keys', () => {
    assert.equal(keyEstablishesKeyboardModality('Tab'), true);
    assert.equal(keyEstablishesKeyboardModality('ArrowRight'), true);
    assert.equal(keyEstablishesKeyboardModality('Enter'), true);
    assert.equal(keyEstablishesKeyboardModality(' '), true);
    assert.equal(keyEstablishesKeyboardModality('a'), false);
  });

  it('reserves 48 px only when the nav row is visible', () => {
    assert.equal(ACCESSIBLE_NAV_TARGET_PX, 48);
    assert.equal(accessibleNavChromeReserve(false), 0);
    assert.equal(accessibleNavChromeReserve(true), 48);
  });
});

describe('focus ring tokens', () => {
  it('declares 2px ring + 2px gap; shell Paper + sheet Ink (Lz-41)', () => {
    assert.equal(A11Y_FOCUS_RING.widthPx, 2);
    assert.equal(A11Y_FOCUS_RING.offsetPx, 2);
    assert.equal(A11Y_FOCUS_RING.onShell, '#F5F1E8');
    assert.equal(A11Y_FOCUS_RING.onOrangeOrLight, '#172126');
    const css = a11yFocusRingCss();
    assert.match(css, /card-a11y-surface"\]:focus-visible/);
    assert.match(css, /a11y-nav-next"\]:focus-visible/);
    assert.match(css, /app-menu-trigger"\]:focus-visible/);
    assert.match(css, /laterality-label"\]:focus-visible/);
    assert.match(css, /laterality-sheet-close"\]:focus-visible/);
    // Shell controls: Paper. Sheet controls: Ink.
    assert.match(css, /outline: 2px solid #F5F1E8/);
    assert.match(css, /outline: 2px solid #172126/);
    assert.match(css, /outline-offset: 2px/);
  });
});

describe('CARD_ACCESSIBILITY_ACTION_DEFS (Lz-43 labels, no device SR)', () => {
  it('declares activate/next/previous/complexity actions with Lz-43 keys', () => {
    const names = CARD_ACCESSIBILITY_ACTION_DEFS.map((d) => d.name);
    assert.deepEqual(names, [
      'activate',
      'next',
      'previous',
      'complexityUp',
      'complexityDown',
    ]);
    assert.deepEqual(
      CARD_ACCESSIBILITY_ACTION_DEFS.map((d) => d.labelKey),
      [
        'actionTurn',
        'actionNext',
        'actionPrevious',
        'actionComplexityUp',
        'actionComplexityDown',
      ],
    );
  });

  it('resolves short en/es labels from the i18n catalog (static AC)', () => {
    for (const def of CARD_ACCESSIBILITY_ACTION_DEFS) {
      const en = messages.en[def.labelKey];
      const es = messages.es[def.labelKey];
      assert.equal(typeof en, 'string');
      assert.equal(typeof es, 'string');
      assert.ok(en.length > 0, `missing EN for ${def.labelKey}`);
      assert.ok(es.length > 0, `missing ES for ${def.labelKey}`);
      assert.notEqual(en, es, `${def.labelKey} should differ across locales`);
    }
    assert.equal(messages.en.actionNext, 'Next');
    assert.equal(messages.es.actionNext, 'Siguiente');
    assert.equal(messages.en.actionTurn, 'Turn');
    assert.equal(messages.es.actionTurn, 'Girar');
    assert.equal(messages.en.actionComplexityUp, 'More complex');
    assert.equal(messages.es.actionComplexityDown, 'Más sencillo');
  });
});

describe('component wiring kills surviving a11y mutations', () => {
  const stackSrc = readFileSync(join(here, '../components/ConceptCardStack.tsx'), 'utf8');
  const rowSrc = readFileSync(join(here, '../components/AccessibleNavRow.tsx'), 'utf8');
  const hookSrc = readFileSync(join(here, '../hooks/useAccessibleNavVisible.ts'), 'utf8');

  it('nav row uses navButtonA11yProps (role, label, disabled state)', () => {
    assert.match(rowSrc, /navButtonA11yProps/);
    assert.match(rowSrc, /accessibilityRole=\{a11y\.accessibilityRole\}/);
    assert.match(rowSrc, /accessibilityLabel=\{a11y\.accessibilityLabel\}/);
    assert.match(rowSrc, /accessibilityState=\{a11y\.accessibilityState\}/);
    assert.match(rowSrc, /isCardActionDisabled/);
  });

  it('nav Pressable disabled prop is pinned to a11y.disabled (not forced false)', () => {
    // Surviving mutation: `const disabled = false;` — Pressable.disabled must track the gate.
    assert.match(rowSrc, /const disabled = a11y\.disabled;/);
    assert.match(rowSrc, /disabled=\{disabled\}/);
    assert.equal(rowSrc.includes('const disabled = false;'), false);
    assert.equal(rowSrc.includes('disabled={false}'), false);
  });

  it('card surface passes accessibilityActions (survives prop-removal mutation)', () => {
    assert.match(
      stackSrc,
      /accessibilityActions=\{surfaceIsButton \? accessibilityActions : undefined\}/,
    );
    assert.match(
      stackSrc,
      /onAccessibilityAction=\{surfaceIsButton \? onAccessibilityAction : undefined\}/,
    );
  });

  it('onAccessibilityAction dispatches to runAction after resolveRunnable', () => {
    // Surviving mutation: handler returns without calling runAction.
    const handler = stackSrc.match(
      /const onAccessibilityAction = useCallback\(\s*\(event: AccessibilityActionEvent\) => \{([\s\S]*?)\},\s*\[actionGate, runAction\]/,
    );
    assert.ok(handler, 'onAccessibilityAction callback missing');
    const body = handler![1];
    assert.match(body, /resolveRunnableAccessibilityAction/);
    assert.match(body, /runAction\(action\)/);
    assert.equal(/if \(action == null\) return;\s*\}/.test(body), false);
  });

  it('runAction and a11y dispatch go through canRunCardAction / resolveRunnable', () => {
    assert.match(stackSrc, /if \(!canRunCardAction\(action, actionGate\(\)\)\) return/);
    assert.match(stackSrc, /resolveRunnableAccessibilityAction/);
    assert.match(stackSrc, /buildCardAccessibilityActions\(t\)/);
    assert.match(stackSrc, /activeLocale/);
    assert.match(stackSrc, /shouldHandleCardSurfaceKey/);
    assert.match(stackSrc, /cardWebTabIndex/);
    assert.match(stackSrc, /cardSurfaceIsAccessibleButton/);
  });

  it('web ignores isScreenReaderEnabled for the nav row', () => {
    assert.match(hookSrc, /shouldQueryScreenReaderForNav/);
    assert.match(hookSrc, /shouldClearKeyboardModalityOnPointer/);
  });

  it('back Wikipedia link activates on Enter without relying on Pressable defaults', () => {
    const cardSrc = readFileSync(join(here, '../components/ConceptCard.tsx'), 'utf8');
    assert.match(cardSrc, /card-back-wikipedia/);
    assert.match(cardSrc, /wikiWebKeyProps/);
    assert.match(cardSrc, /key !== 'Enter'/);
    assert.match(cardSrc, /openWiki\(\)/);
  });

  it('nav row wraps (flexWrap) and keeps whole-word label CSS', () => {
    assert.match(rowSrc, /flexWrap:\s*'wrap'/);
    assert.match(rowSrc, /flexBasis:\s*'30%'/);
    assert.match(rowSrc, /wordBreak:\s*'normal'/);
    assert.match(rowSrc, /overflowWrap:\s*'normal'/);
    assert.equal(rowSrc.includes('numberOfLines'), false);
  });
});
