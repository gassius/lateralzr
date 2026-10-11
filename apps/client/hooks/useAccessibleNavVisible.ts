import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  keyEstablishesKeyboardModality,
  shouldShowAccessibleNavRow,
} from '@/lib/cardActions';

/**
 * Optional assistive nav row: visible only when a screen reader is on or the
 * user is in keyboard modality (web focus-visible / key navigation).
 */
export function useAccessibleNavVisible(): boolean {
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [keyboardModality, setKeyboardModality] = useState(false);

  useEffect(() => {
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
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (keyEstablishesKeyboardModality(event.key)) {
        setKeyboardModality(true);
      }
    };
    const clearKeyboardModality = () => {
      setKeyboardModality(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', clearKeyboardModality, true);
    window.addEventListener('touchstart', clearKeyboardModality, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', clearKeyboardModality, true);
      window.removeEventListener('touchstart', clearKeyboardModality, true);
    };
  }, []);

  return shouldShowAccessibleNavRow({ screenReaderEnabled, keyboardModality });
}
