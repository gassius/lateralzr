import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';

import {
  webPhoneFrameSize,
  webPreviewSafeAreaMetrics,
  type WebPhoneFrameSize,
} from '@/lib/webPhoneFrame';
import { color, webPreview } from '@/theme/tokens';

const WebPhoneFrameContext = createContext<WebPhoneFrameSize | null>(null);

/** SPA (`web.output: "single"`) does not emit `+html.tsx`; inject letterbox CSS at runtime. */
const LETTERBOX_STYLE_ID = 'lateralzr-web-phone-frame';
const LETTERBOX_CSS = `
html, body, #root { height: 100%; }
body { background-color: ${webPreview.outside}; overflow: hidden; }
#web-phone-frame { box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45); }
`;

function useLetterboxDocumentStyles() {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(LETTERBOX_STYLE_ID);
    if (existing) {
      existing.textContent = LETTERBOX_CSS;
      return;
    }
    const style = document.createElement('style');
    style.id = LETTERBOX_STYLE_ID;
    style.textContent = LETTERBOX_CSS;
    document.head.appendChild(style);
  }, []);
}

/**
 * Expo web only (Vercel preview): center a mobile-portrait frame on wide
 * screens and letterbox the rest. Narrow viewports fill the window.
 * Outside the frame is near-black (§16.3); petrol lives only inside.
 */
export function WebPhoneFrame({ children }: { children: ReactNode }) {
  useLetterboxDocumentStyles();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const size = useMemo(
    () => webPhoneFrameSize(viewportWidth, viewportHeight),
    [viewportWidth, viewportHeight],
  );
  const metrics = useMemo(
    () => webPreviewSafeAreaMetrics(size.width, size.height),
    [size.width, size.height],
  );

  return (
    <WebPhoneFrameContext.Provider value={size}>
      <View nativeID="web-phone-stage" testID="web-phone-stage" style={styles.stage}>
        <View
          nativeID={size.framed ? 'web-phone-frame' : 'web-phone-fill'}
          testID="web-phone-frame"
          // RN-web dataSet → data-safe-top / data-safe-bottom for E2E.
          {...({
            dataSet: {
              safeTop: String(metrics.insets.top),
              safeBottom: String(metrics.insets.bottom),
            },
          } as Record<string, unknown>)}
          style={[
            styles.phone,
            size.framed && styles.phoneFramed,
            { width: size.width, height: size.height },
          ]}
        >
          {/* Context only: the measuring provider overwrites CSS env to 0 on web. */}
          <View style={styles.safeAreaFill}>
            <SafeAreaFrameContext.Provider value={metrics.frame}>
              <SafeAreaInsetsContext.Provider value={metrics.insets}>
                {children}
              </SafeAreaInsetsContext.Provider>
            </SafeAreaFrameContext.Provider>
          </View>
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
    backgroundColor: webPreview.outside,
  },
  phone: {
    overflow: 'hidden',
    backgroundColor: color.shell,
    flexShrink: 0,
  },
  phoneFramed: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: webPreview.frameEdge,
  },
  safeAreaFill: {
    flex: 1,
  },
});
