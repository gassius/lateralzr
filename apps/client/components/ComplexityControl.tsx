import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type View as ViewType,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';
import { t } from '@/lib/i18n';
import {
  COMPLEXITY_CONTROL_HEIGHT,
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  LATERALITY_ROW_PADDING_HORIZONTAL,
} from '@/lib/lateralityChrome';
import {
  clampComplexityGrade,
  complexityA11yText,
  complexityBarLabel,
  complexityCommitFromRail,
  complexityNextFromControlInput,
  complexityStepFromX,
  MAX_COMPLEXITY,
  MIN_COMPLEXITY,
  type ComplexityGrade,
} from '@/lib/complexityControl';

type ComplexityControlProps = {
  complexity: ComplexityGrade | number;
  disabled?: boolean;
  onSelectComplexity: (grade: ComplexityGrade) => void;
  /** Opens the Complexity picker (same view as the app-menu Complexity row). */
  onPressLabel?: () => void;
  onHeightChange?: (height: number) => void;
  /** Host for focus restore when the picker closes. */
  labelRef?: RefObject<ViewType | null>;
};

const DOT_COUNT = 5;
const DOT_RADIUS = 4.5;
const LINE_STROKE = 1.75;
const CHEVRON_SIZE = 12;

const chevronInlineWebStyle =
  Platform.OS === 'web'
    ? ({ display: 'inline-flex', verticalAlign: 'middle' } as Record<string, string>)
    : null;

const LABEL_HIT_SLOP = Math.max(
  0,
  Math.ceil((layout.recommendedTouchTarget - LATERALITY_LABEL_ROW_HEIGHT) / 2),
);

function ChevronDown({ stroke }: { stroke: string }) {
  return (
    <Svg
      width={CHEVRON_SIZE}
      height={CHEVRON_SIZE}
      viewBox="0 0 12 12"
      accessible={false}
      testID="complexity-label-chevron"
    >
      <Polyline
        points="2,4 6,8 10,4"
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ComplexityRail({
  grade,
  width,
}: {
  grade: ComplexityGrade;
  width: number;
}) {
  if (width <= 0) return null;
  const inset = DOT_RADIUS + 1;
  const usable = Math.max(0, width - inset * 2);
  const step = DOT_COUNT > 1 ? usable / (DOT_COUNT - 1) : 0;
  const cy = LATERALITY_RAIL_HEIGHT / 2;

  return (
    <Svg width={width} height={LATERALITY_RAIL_HEIGHT} accessible={false}>
      <Line
        x1={inset}
        y1={cy}
        x2={width - inset}
        y2={cy}
        stroke={color.rail}
        strokeWidth={LINE_STROKE}
        strokeLinecap="round"
      />
      {Array.from({ length: DOT_COUNT }, (_, i) => {
        const n = (i + 1) as ComplexityGrade;
        const cx = inset + step * i;
        const selected = n === grade;
        return (
          <Circle
            key={n}
            cx={cx}
            cy={cy}
            r={DOT_RADIUS}
            fill={selected ? color.front : color.rail}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Persistent Complexity bar (guide §9.7). Mirrors {@link LateralityControl}
 * without a messaging band — label + chevron + five-dot rail.
 */
export function ComplexityControl({
  complexity,
  disabled = false,
  onSelectComplexity,
  onPressLabel,
  onHeightChange,
  labelRef,
}: ComplexityControlProps) {
  const grade = clampComplexityGrade(complexity);
  const [railWidth, setRailWidth] = useState(0);
  const [previewGrade, setPreviewGrade] = useState<ComplexityGrade | null>(null);
  const displayGrade = previewGrade ?? grade;
  const railWidthRef = useRef(0);
  const reportedHeightRef = useRef(0);

  const labelText = useMemo(() => complexityBarLabel(displayGrade), [displayGrade]);
  const a11yText = complexityA11yText(displayGrade);

  const previewAt = useCallback(
    (x: number) => {
      if (disabled) return;
      setPreviewGrade(complexityStepFromX(x, railWidthRef.current));
    },
    [disabled],
  );

  const commitAt = useCallback(
    (x: number) => {
      const next = complexityCommitFromRail(x, railWidthRef.current, { swapping: disabled });
      setPreviewGrade(null);
      if (next == null) return;
      onSelectComplexity(next);
    },
    [disabled, onSelectComplexity],
  );

  const endPreview = useCallback(() => {
    setPreviewGrade(null);
  }, []);

  const onRailLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== railWidthRef.current) {
      railWidthRef.current = next;
      setRailWidth(next);
    }
  }, []);

  const onRootLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.ceil(event.nativeEvent.layout.height);
      if (next <= 0 || next === reportedHeightRef.current) return;
      reportedHeightRef.current = next;
      onHeightChange?.(next);
    },
    [onHeightChange],
  );

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((e) => {
      runOnJS(commitAt)(e.x);
    });

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      runOnJS(previewAt)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(previewAt)(e.x);
    })
    .onEnd((e) => {
      runOnJS(commitAt)(e.x);
    })
    .onFinalize(() => {
      runOnJS(endPreview)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const next = complexityNextFromControlInput(grade, event.nativeEvent.actionName, {
        swapping: disabled,
      });
      if (next == null) return;
      onSelectComplexity(next);
    },
    [disabled, grade, onSelectComplexity],
  );

  const onKeyDown = useCallback(
    (event: NativeSyntheticEvent<{ key: string }>) => {
      const next = complexityNextFromControlInput(grade, event.nativeEvent.key, {
        swapping: disabled,
      });
      if (next == null) return;
      onSelectComplexity(next);
    },
    [disabled, grade, onSelectComplexity],
  );

  const webFocusProps =
    Platform.OS === 'web'
      ? ({
          tabIndex: disabled ? -1 : 0,
          onKeyDown,
          'aria-valuemin': MIN_COMPLEXITY,
          'aria-valuemax': MAX_COMPLEXITY,
          'aria-valuenow': displayGrade,
          'aria-valuetext': a11yText,
        } as Record<string, unknown>)
      : {};

  return (
    <View
      style={styles.root}
      testID="complexity-control"
      accessibilityState={{ disabled }}
      onLayout={onRootLayout}
    >
      <View style={styles.labelRow}>
        <Pressable
          ref={labelRef}
          onPress={onPressLabel ?? (() => {})}
          disabled={disabled}
          hitSlop={LABEL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={labelText}
          accessibilityState={{ disabled }}
          testID="complexity-label"
          style={({ pressed }) => [
            styles.labelCluster,
            pressed && !disabled ? styles.labelPressed : null,
            disabled ? styles.disabled : null,
          ]}
          {...(Platform.OS === 'web'
            ? ({ tabIndex: disabled ? -1 : 0 } as Record<string, unknown>)
            : {})}
        >
          <Text style={[styles.labelText, textStyle('label')]}>
            {labelText}
            {'\u00A0'}
            <View
              style={[styles.chevronInline, chevronInlineWebStyle]}
              accessibilityElementsHidden
            >
              <ChevronDown stroke={color.paper} />
            </View>
          </Text>
        </Pressable>
      </View>

      <GestureDetector gesture={composed}>
        <View
          style={styles.railHit}
          testID="complexity-rail"
          onLayout={onRailLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('menuComplexity')}
          accessibilityValue={{
            min: MIN_COMPLEXITY,
            max: MAX_COMPLEXITY,
            now: displayGrade,
            text: a11yText,
          }}
          accessibilityActions={[
            { name: 'increment', label: t('actionComplexityUp') },
            { name: 'decrement', label: t('actionComplexityDown') },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          accessibilityState={{ disabled }}
          {...webFocusProps}
        >
          <ComplexityRail
            grade={displayGrade}
            width={
              railWidth > 0
                ? railWidth
                : LATERALITY_BAR_MIN_ROW_WIDTH - LATERALITY_ROW_PADDING_HORIZONTAL * 2
            }
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: COMPLEXITY_CONTROL_HEIGHT,
    paddingHorizontal: LATERALITY_ROW_PADDING_HORIZONTAL,
    justifyContent: 'flex-start',
  },
  labelRow: {
    minHeight: LATERALITY_LABEL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    overflow: 'visible',
  },
  labelCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 0,
    flexShrink: 1,
    maxWidth: '100%',
    marginLeft: 'auto',
    minHeight: layout.recommendedTouchTarget,
    marginVertical: -Math.ceil(
      (layout.recommendedTouchTarget - LATERALITY_LABEL_ROW_HEIGHT) / 2,
    ),
  },
  labelText: {
    color: color.paper,
    flexShrink: 1,
    textAlign: 'right',
  },
  chevronInline: {
    width: CHEVRON_SIZE,
    height: CHEVRON_SIZE,
    marginLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelPressed: {
    opacity: 0.72,
  },
  railHit: {
    height: LATERALITY_RAIL_HEIGHT,
    width: '100%',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
