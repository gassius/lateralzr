import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Palette } from '@/constants/Colors';
import { webPhoneFrameSize, type WebPhoneFrameSize } from '@/lib/webPhoneFrame';

const WebPhoneFrameContext = createContext<WebPhoneFrameSize | null>(null);

/**
 * Expo web only (Vercel preview): center a mobile-portrait frame on wide
 * screens and letterbox the rest. Narrow viewports fill the window.
 */
export function WebPhoneFrame({ children }: { children: ReactNode }) {
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
