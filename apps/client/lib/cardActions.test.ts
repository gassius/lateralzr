import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCESSIBLE_NAV_TARGET_PX,
  accessibleNavChromeReserve,
  canRunCardAction,
  CARD_ACCESSIBILITY_ACTION_DEFS,
  cardActionFromAccessibilityName,
  cardActionFromKey,
  complexityDirectionForAction,
  keyEstablishesKeyboardModality,
  shouldShowAccessibleNavRow,
} from './cardActions.ts';
import { messages } from './i18n.ts';

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

  it('blocks all actions while animating or on the deck-status card', () => {
    assert.equal(canRunCardAction('next', { ...open, animating: true }), false);
    assert.equal(canRunCardAction('flip', { ...open, showDeckStatus: true }), false);
    assert.equal(canRunCardAction('complexityUp', { ...open, showDeckStatus: true }), false);
  });
});

describe('complexityDirectionForAction', () => {
  it('mirrors vertical swipe directions', () => {
    assert.equal(complexityDirectionForAction('complexityUp'), 'up');
    assert.equal(complexityDirectionForAction('complexityDown'), 'down');
  });
});

describe('shouldShowAccessibleNavRow', () => {
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

  it('resolves en/es labels from the i18n catalog (static AC)', () => {
    for (const def of CARD_ACCESSIBILITY_ACTION_DEFS) {
      const en = messages.en[def.labelKey];
      const es = messages.es[def.labelKey];
      assert.equal(typeof en, 'string');
      assert.equal(typeof es, 'string');
      assert.ok(en.length > 0, `missing EN for ${def.labelKey}`);
      assert.ok(es.length > 0, `missing ES for ${def.labelKey}`);
      assert.notEqual(en, es, `${def.labelKey} should differ across locales`);
    }
    assert.equal(messages.en.actionNext, 'Next concept');
    assert.equal(messages.es.actionNext, 'Siguiente concepto');
    assert.equal(messages.en.actionTurn, 'Turn card');
    assert.equal(messages.es.actionTurn, 'Girar carta');
    assert.equal(messages.en.actionComplexityUp, 'More complex');
    assert.equal(messages.es.actionComplexityDown, 'Más sencillo');
  });
});
