import { test } from '@playwright/test';

/**
 * Placeholders for settings surfaces. Each epic PR that lands a picker should
 * remove the matching skip and call capture(name).
 */
test.describe('settings pickers', () => {
  test('language picker', async () => {
    test.skip(true, 'Language picker UI not on main yet.');
  });

  test('complexity picker', async () => {
    test.skip(true, 'Complexity picker UI not on main yet.');
  });

  test('motion setting', async () => {
    test.skip(true, 'Motion setting UI not on main yet.');
  });

  test('about view', async () => {
    test.skip(true, 'About view not on main yet.');
  });
});
