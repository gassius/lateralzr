import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Palette } from '@/constants/Colors';
import { webPhoneFrameSize, type WebPhoneFrameSize } from '@/lib/webPhoneFrame';

const WebPhoneFrameContext = createContext<WebPhoneFrameSize | null>(null);

/** SPA (`web.output: "single"`) does not emit `+html.tsx`; inject letterbox CSS at runtime. */
const LETTERBOX_STYLE_ID = 'lateralzr-web-phone-frame';
const LETTERBOX_CSS = `
html, body, #root { height: 100%; }
body { background-color: #111111; overflow: hidden; }
#web-phone-frame { box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45); }
`;

function useLetterboxDocumentStyles() {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(LETTERBOX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LETTERBOX_STYLE_ID;
    style.textContent = LETTERBOX_CSS;
    document.head.appendChild(style);
  }, []);
}

/**
 * Expo web only (Vercel preview): center a mobile-portrait frame on wide
 * screens and letterbox the rest. Narrow viewports fill the window.
 */
export function WebPhoneFrame({ children }: { children: ReactNode }) {
  useLetterboxDocumentStyles();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const size = useMemo(
    () => webPhoneFrameSize(viewportWidth, viewportHeight),
    [viewportWidth, viewportHeight],
  );

  return (
    <WebPhoneFrameContext.Provider value={size}>
      <View nativeID="web-phone-stage" testID="web-phone-stage" style={styles.stage}>
        <View
          nativeID={size.framed ? 'web-phone-frame' : 'web-phone-fill'}
          testID="web-phone-frame"
          style={[
            styles.phone,
            size.framed && styles.phoneFramed,
            { width: size.width, height: size.height },
          ]}
        >
          {children}
        </View>
      </View>
    </WebPhoneFrameContext.Provider>
  );
}

export function useWebPhoneFrameSize(): WebPhoneFrameSize | null {
  return useContext(WebPhoneFrameContext);
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.black,
  },
  phone: {
    overflow: 'hidden',
    backgroundColor: Palette.darkBlue,
    flexShrink: 0,
  },
  phoneFramed: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
