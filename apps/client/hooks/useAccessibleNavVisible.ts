import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  keyEstablishesKeyboardModality,
  shouldClearKeyboardModalityOnPointer,
  shouldQueryScreenReaderForNav,
  shouldShowAccessibleNavRow,
} from '@/lib/cardActions';

/**
 * Optional assistive nav row: visible only when a screen reader is on or the
 * user is in keyboard modality (web focus-visible / key navigation).
 * On web, screen-reader probing is skipped — RN-web always reports enabled.
 */
export function useAccessibleNavVisible(): boolean {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [keyboardModality, setKeyboardModality] = useState(false);

  useEffect(() => {
    if (!shouldQueryScreenReaderForNav(Platform.OS)) {
      setScreenReaderEnabled(false);
      return;
    }

    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
      setScreenReaderEnabled(enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (keyEstablishesKeyboardModality(event.key)) {
        setKeyboardModality(true);
      }
    };
    const onPointerOrTouch = (event: Event) => {
      const row = document.querySelector('[data-testid="accessible-nav-row"]');
      if (!shouldClearKeyboardModalityOnPointer(event.target, row)) {
        return;
      }
      setKeyboardModality(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerOrTouch, true);
    window.addEventListener('touchstart', onPointerOrTouch, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerOrTouch, true);
      window.removeEventListener('touchstart', onPointerOrTouch, true);
    };
  }, []);

  return shouldShowAccessibleNavRow({ screenReaderEnabled, keyboardModality });
}
