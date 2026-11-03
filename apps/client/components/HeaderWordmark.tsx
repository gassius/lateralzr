import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import {
  WORDMARK_ASPECT,
  WORDMARK_GROUP_TRANSFORM,
  WORDMARK_LETTERS,
  wordmarkViewBoxAttr,
} from '@/assets/images/lateralzrWordmark';
import { practiceWordmarkHeight } from '@/lib/practiceLayout';
import { color } from '@/theme/tokens';

type HeaderWordmarkProps = {
  /** Override display height (defaults to header.wordmark.heightPt ≈ 20). */
  height?: number;
  testID?: string;
};

/**
 * Petrol-header wordmark (guide §5.2 / §9.7). Paper fill, logo paths only —
 * never Inter, never the bulb mark.
 *
 * Decorative: hidden from AT (branding is already in the app name / intro).
 */
export function HeaderWordmark({
  height = practiceWordmarkHeight(),
  testID = 'header-wordmark',
}: HeaderWordmarkProps) {
  const width = height * WORDMARK_ASPECT;

  return (
    <View
      style={[styles.root, { width, height }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID={testID}
    >
      <Svg
        width={width}
        height={height}
        viewBox={wordmarkViewBoxAttr()}
        accessible={false}
      >
        <G transform={WORDMARK_GROUP_TRANSFORM}>
          {WORDMARK_LETTERS.map((letter) => (
            <Path
              key={letter.id}
              d={letter.d}
              transform={letter.transform}
              fill={color.paper}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
});
