import { forwardRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { practiceMenuTriggerSize } from '@/lib/practiceLayout';
import { t } from '@/lib/i18n';
import { color } from '@/theme/tokens';

type AppMenuTriggerProps = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Top-right ellipsis that opens the app menu (Lz-32).
 * Drawn with react-native-svg; 48×48 hit target; a11y name from `t('openMenu')`.
 * Practice screen mounts this only when {@link APP_MENU_TRIGGER_ENABLED} is true.
 */
export const AppMenuTrigger = forwardRef<View, AppMenuTriggerProps>(function AppMenuTrigger(
  { onPress, style, testID = 'app-menu-trigger' },
  ref,
) {
  const size = practiceMenuTriggerSize();
  const webFocusProps =
    Platform.OS === 'web' ? ({ tabIndex: 0 } as Record<string, unknown>) : {};

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={t('openMenu')}
      onPress={onPress}
      testID={testID}
      style={[styles.hit, { width: size, height: size }, style]}
      {...webFocusProps}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
        <Circle cx={5} cy={12} r={1.75} fill={color.paper} />
        <Circle cx={12} cy={12} r={1.75} fill={color.paper} />
        <Circle cx={19} cy={12} r={1.75} fill={color.paper} />
      </Svg>
    </Pressable>
  );
});
AppMenuTrigger.displayName = 'AppMenuTrigger';

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
