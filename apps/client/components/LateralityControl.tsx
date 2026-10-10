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
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_CONTROL_HEIGHT,
  LATERALITY_LABEL_ROW_HEIGHT,
  LATERALITY_RAIL_HEIGHT,
  LATERALITY_ROW_PADDING_HORIZONTAL,
} from '@/lib/lateralityChrome';
import {
  clampLaterality,
  lateralityA11yText,
  lateralityCommitFromRail,
  lateralityControlDisabled,
  lateralityGradeLabelKey,
  lateralityNextFromControlInput,
  lateralityStepFromX,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from '@/lib/laterality';

type LateralityControlProps = {
  laterality: LateralityGrade | number;
  swapping?: boolean;
  onSelectLaterality: (grade: LateralityGrade) => void;
  /** Opens the laterality sheet (Lz-31). */
  onPressLabel?: () => void;
  /** Measured control height (grows when the label wraps at large text). */
  onHeightChange?: (height: number) => void;
  /** Host for focus restore when the sheet closes. */
  labelRef?: RefObject<ViewType | null>;
};

const DOT_COUNT = 5;
const DOT_RADIUS = 4.5;
const LINE_STROKE = 1.75;
const CHEVRON_SIZE = 12;

/** Expand the visual label row (~20 px) to a 48 px tap target via hitSlop. */
const LABEL_HIT_SLOP = Math.max(
  0,
  Math.ceil((layout.recommendedTouchTarget - LATERALITY_LABEL_ROW_HEIGHT) / 2),
);

function ChevronDown({ stroke }: { stroke: string }) {
  return (
    <Svg width={CHEVRON_SIZE} height={CHEVRON_SIZE} viewBox="0 0 12 12" accessible={false}>
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

function LateralityRail({
  grade,
  width,
}: {
  grade: LateralityGrade;
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
        const n = (i + 1) as LateralityGrade;
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

export function LateralityControl({
  laterality,
  swapping = false,
  onSelectLaterality,
  onPressLabel,
  onHeightChange,
  labelRef,
}: LateralityControlProps) {
  const grade = clampLaterality(laterality);
  const disabled = lateralityControlDisabled(true, swapping);
  const [railWidth, setRailWidth] = useState(0);
  const [previewGrade, setPreviewGrade] = useState<LateralityGrade | null>(null);
  const displayGrade = previewGrade ?? grade;
  const railWidthRef = useRef(0);
  const reportedHeightRef = useRef(0);

  const labelText = useMemo(
    () => `${t('laterality')} · ${t(lateralityGradeLabelKey(displayGrade))}`,
    [displayGrade],
  );
  const a11yText = lateralityA11yText(displayGrade);

  const previewAt = useCallback(
    (x: number) => {
      if (disabled) return;
      setPreviewGrade(lateralityStepFromX(x, railWidthRef.current));
    },
    [disabled],
  );

  const commitAt = useCallback(
    (x: number) => {
      const next = lateralityCommitFromRail(x, railWidthRef.current, { swapping });
      setPreviewGrade(null);
      if (next == null) return;
      onSelectLaterality(next);
    },
    [onSelectLaterality, swapping],
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
      const next = lateralityNextFromControlInput(grade, event.nativeEvent.actionName, {
        swapping,
      });
      if (next == null) return;
      onSelectLaterality(next);
    },
    [grade, onSelectLaterality, swapping],
  );

  const onKeyDown = useCallback(
    (event: NativeSyntheticEvent<{ key: string }>) => {
      const next = lateralityNextFromControlInput(grade, event.nativeEvent.key, { swapping });
      if (next == null) return;
      onSelectLaterality(next);
    },
    [grade, onSelectLaterality, swapping],
  );

  const webFocusProps =
    Platform.OS === 'web'
      ? ({
          tabIndex: disabled ? -1 : 0,
          onKeyDown,
        } as Record<string, unknown>)
      : {};

  return (
    <View
      style={styles.root}
      testID="laterality-control"
      accessibilityState={{ busy: swapping, disabled }}
      onLayout={onRootLayout}
    >
      <Pressable
        ref={labelRef}
        onPress={onPressLabel ?? (() => {})}
        disabled={disabled}
        hitSlop={LABEL_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={labelText}
        accessibilityState={{ disabled }}
        testID="laterality-label"
        style={({ pressed }) => [
          styles.labelRow,
          pressed && !disabled ? styles.labelPressed : null,
          disabled ? styles.disabled : null,
        ]}
        {...(Platform.OS === 'web'
          ? ({ tabIndex: disabled ? -1 : 0 } as Record<string, unknown>)
          : {})}
      >
        <Text style={[styles.labelText, textStyle('label')]}>{labelText}</Text>
        <ChevronDown stroke={color.paper} />
      </Pressable>

      <GestureDetector gesture={composed}>
        <View
          style={styles.railHit}
          testID="laterality-rail"
          onLayout={onRailLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('laterality')}
          accessibilityValue={{
            min: MIN_LATERALITY,
            max: MAX_LATERALITY,
            now: displayGrade,
            text: a11yText,
          }}
          accessibilityActions={[
            { name: 'increment', label: t('increaseLaterality') },
            { name: 'decrement', label: t('decreaseLaterality') },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          accessibilityState={{ disabled, busy: swapping }}
          {...webFocusProps}
        >
          <LateralityRail
            grade={displayGrade}
            width={railWidth > 0 ? railWidth : LATERALITY_BAR_MIN_ROW_WIDTH - LATERALITY_ROW_PADDING_HORIZONTAL * 2}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: LATERALITY_CONTROL_HEIGHT,
    paddingHorizontal: LATERALITY_ROW_PADDING_HORIZONTAL,
    justifyContent: 'flex-start',
  },
  labelRow: {
    minHeight: LATERALITY_LABEL_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    alignSelf: 'stretch',
  },
  labelText: {
    color: color.paper,
    flexShrink: 1,
    textAlign: 'right',
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
