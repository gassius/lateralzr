import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ConceptItem } from '@/lib/api';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  CARD_BACK_MEDIA_CONTENT_FIT,
  CARD_BACK_MEDIA_CONTENT_POSITION,
  cardBackScrollContentStyle,
  composeCardBackLayout,
  resolveCardBackMediaPhase,
  type CardBackLayout,
} from '@/lib/cardBackLayout';
import {
  CARD_BACK_MEDIA_DECODE_TIMEOUT_MS,
  CARD_BACK_MEDIA_FADE_IN_MS,
  CARD_BACK_MEDIA_SEAM_OVERLAP,
  resolveCardBackMediaBand,
  resolveCardBackMediaFade,
  resolveCardBackMediaFit,
  resolveContainMediaBox,
  resolveInformativeAlt,
} from '@/lib/cardBackMedia';
import {
  cardBackCreditHasRow,
  cardBackLicenceHitSlop,
  resolveCardBackCredit,
} from '@/lib/cardBackCredit';
import {
  resolveShowMediaCredits,
  resolveShowReferenceLinks,
} from '@/lib/buildFlags';
import {
  CARD_FACE_FALLBACK_WIDTH,
  CARD_SHADOW,
  cardPadding,
  cardRadius,
} from '@/lib/cardLayout';
import { conceptKey } from '@/lib/conceptDeck';
import {
  CONCEPT_FRONT_TITLE_BOTTOM_RESERVE,
  CONCEPT_FRONT_TITLE_FONT_SIZE,
  CONCEPT_FRONT_TITLE_FONT_STACK,
  CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
  CONCEPT_FRONT_TITLE_MAX_LINES,
  CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  CONCEPT_FRONT_TITLE_TEXT_ALIGN,
  NATIVE_TITLE_MEASURE_FALLBACK_MS,
  applyNativeTitleTextLayoutOnce,
  conceptFrontTitleBlockHeight,
  conceptFrontTitleBottomSpacerMinHeight,
  conceptFrontTitleInkWidth,
  conceptFrontTitleLineCount,
  conceptFrontTitleNativeProbeText,
  conceptFrontTitleOverflowTopSpacerHeight,
  conceptFrontTitleRenderedSize,
  conceptFrontTitleTopSpacerHeight,
  conceptFrontTitleViewportBlockHeight,
  getCachedNativeTitleLayout,
  layoutConceptFrontTitle,
  measureConceptFrontTitleWidth,
  nativeTitleFallbackLayout,
  nativeTitleMeasureCacheKey,
  shouldCommitNativeTitleLayoutToView,
  titleColor,
  type ConceptFrontTitleLayout,
} from '@/lib/conceptFrontTitle';
import { buildNoMediaEmbossXml, resolveNoMediaEmbossHeight } from '@/lib/noMediaEmboss';
import { buildPatternSvgXml, type PatternRect } from '@/lib/patternPlacement';
import { NoMediaEmboss } from './brand/NoMediaEmboss';
import { PatternLayer } from './brand/PatternLayer';
import { cardFlipA11yFace, cardFlipFaceStyle, flipDurationMs } from '@/lib/cardFlip';
import { FLIP_COACH_PEEK_AMOUNT } from '@/lib/discoveryCoaching';
import { t } from '@/lib/i18n';
import { remoteImageSource } from '@/lib/remoteImage';
import { readJourneyTestParams } from '@/lib/testQueryParams';

const LINK_HIT = layout.recommendedTouchTarget;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function capitalizeFirstLetter(text: string) {
  if (!text.length) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function coverContentPosition(
  focalX?: number | null,
  focalY?: number | null,
): typeof CARD_BACK_MEDIA_CONTENT_POSITION | { left: string; top: string } {
  const hasX = typeof focalX === 'number' && Number.isFinite(focalX);
  const hasY = typeof focalY === 'number' && Number.isFinite(focalY);
  if (!hasX && !hasY) return CARD_BACK_MEDIA_CONTENT_POSITION;
  const x = hasX ? Math.min(1, Math.max(0, focalX as number)) : 0.5;
  const y = hasY ? Math.min(1, Math.max(0, focalY as number)) : 0.5;
  return { left: `${Math.round(x * 100)}%`, top: `${Math.round(y * 100)}%` };
}

type ConceptCardProps = {
  item: ConceptItem;
  flipped: boolean;
  /** OS / shared Reduce Motion gate — opacity cross-fade, no 3D. */
  reduceMotion?: boolean;
  /** True when this URL was successfully prefetched (smoother reveal, shorter transition). */
  isMediaPrefetched: boolean;
  /**
   * Screen-reader coaching path (§12.3): tip copy as accessibilityHint instead
   * of a visual chip. Visual tips render in the shell control region.
   */
  accessibilityHint?: string;
  /** 0–1 light flip peek for coaching; ignored once the card is actually flipped. */
  flipPeek?: SharedValue<number>;
  /**
   * Only the interactive front-of-stack card should expose front testIDs
   * (`card-front-title`, `card-front-pattern`) — behind / return-overlay
   * duplicates must not, or Playwright strict mode fails.
   */
  exposeFrontTitleTestId?: boolean;
  /** Wiki / credit press — parent suppresses the stack tap→flip. */
  onBackInteractivePress?: () => void;
  /**
   * Lz-40: stack says the front card may breathe (settled, not flipped/dragging/
   * sheet/background). PatternLayer still gates RM + scroll.
   */
  pulseGateActive?: boolean;
  /** Face padding from the §16.2 aspect helper. */
  facePadding?: number;
  /**
   * Shared Wikimedia request width from `cardLayout.width` (same value as
   * preload). Zero until the stack has measured; then the URI is stable.
   */
  mediaRequestWidth?: number;
  /** Lz-56: UI-thread back-face scroll metrics for the 24 px vertical hand-off. */
  backScrollOffsetY?: SharedValue<number>;
  backScrollContentH?: SharedValue<number>;
  backScrollViewportH?: SharedValue<number>;
  /**
   * Stack-owned 0–1 flip progress. Lives above this card so a remount on
   * back→front (a11y role / wiki tree) cannot snap progress to 0.
   */
  flipProgress?: SharedValue<number>;
};

export function ConceptCard({
  item,
  flipped,
  reduceMotion = false,
  isMediaPrefetched,
  accessibilityHint,
  flipPeek,
  exposeFrontTitleTestId = false,
  onBackInteractivePress,
  pulseGateActive = false,
  facePadding,
  mediaRequestWidth = 0,
  backScrollOffsetY,
  backScrollContentH,
  backScrollViewportH,
  flipProgress: flipProgressShared,
}: ConceptCardProps) {
  const title = capitalizeFirstLetter(item.concept);
  const { width: windowWidth } = useWindowDimensions();
  const facePad = facePadding ?? cardPadding(windowWidth);
  const radius = cardRadius();

  const [mediaDecoded, setMediaDecoded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaSourceSize, setMediaSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mediaSourceType, setMediaSourceType] = useState<string | null>(null);
  const [backFaceH, setBackFaceH] = useState(0);
  const [faceWidth, setFaceWidth] = useState(0);
  const [frontFaceH, setFrontFaceH] = useState(0);
  const [frontContentH, setFrontContentH] = useState(0);
  const [backTextBlockH, setBackTextBlockH] = useState(0);
  const [firstTextY, setFirstTextY] = useState<number | null>(null);
  const backFaceRef = useRef<View>(null);
  const backDescRef = useRef<Text>(null);
  /**
   * Native: committed visible layout (onTextLayout or B2 fallback).
   * Web uses sync DOM measure and never touches this.
   */
  const [nativeTitleLayout, setNativeTitleLayout] = useState<ConceptFrontTitleLayout | null>(
    null,
  );
  /** Bumps when late onTextLayout fills the cache without resizing (unmount probe). */
  const [nativeCacheEpoch, setNativeCacheEpoch] = useState(0);
  /** Ink width/height from title onLayout (column-local); position comes from spacer. */
  const [titleInkSize, setTitleInkSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  /** Lz-40: stop connector pulse while the front face scrolls. */
  const [frontScrolling, setFrontScrolling] = useState(false);
  /** Cache key already written from onTextLayout (ignore further probe events). */
  const nativeMeasureAcceptedRef = useRef<string | null>(null);
  /** True once B2 fallback is painted — late onTextLayout must not resize. */
  const nativeFallbackVisibleRef = useRef(false);
  /** 0 = front, 1 = back — opacity + rotate crossfade (reliable vs single rotateY + overflow on RN). */
  const fallbackFlipProgress = useSharedValue(0);
  const flipProgress = flipProgressShared ?? fallbackFlipProgress;
  const fallbackFlipPeek = useSharedValue(0);
  const flipPeekSV = flipPeek ?? fallbackFlipPeek;
  const reduceMotionSV = useSharedValue(reduceMotion ? 1 : 0);
  const fallbackScrollY = useSharedValue(0);
  const fallbackScrollContentH = useSharedValue(0);
  const fallbackScrollViewportH = useSharedValue(0);
  const scrollY = backScrollOffsetY ?? fallbackScrollY;
  const scrollContentH = backScrollContentH ?? fallbackScrollContentH;
  const scrollViewportH = backScrollViewportH ?? fallbackScrollViewportH;
  const onBackScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      scrollContentH.value = event.contentSize.height;
      scrollViewportH.value = event.layoutMeasurement.height;
    },
  });
  /** AT / pointer face after the flip midpoint — not the `flipped` boolean. */
  const [presentedFace, setPresentedFace] = useState<'front' | 'back'>(
    flipped ? 'back' : 'front',
  );
  const imageSource =
    mediaRequestWidth > 0
      ? remoteImageSource(
          item.mediaUrl,
          Platform.OS,
          resolveApiBaseUrl(),
          mediaRequestWidth,
        )
      : null;
  const mediaUri = imageSource?.uri ?? '';
  const creditedMedia = item.media?.find((media) => media.url === item.mediaUrl);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceMotionSV]);

  const frontTitleBaseStyle = textStyle('concept');
  /**
   * e2eTextScale multiplies textStyle fontSize for display only (#82: keep layout
   * sizes unscaled). OS fontScale + e2eScale are passed into measure as size×scale.
   */
  const e2eScale = Math.max(
    1,
    ((frontTitleBaseStyle.fontSize as number) ?? CONCEPT_FRONT_TITLE_FONT_SIZE) /
      CONCEPT_FRONT_TITLE_FONT_SIZE,
  );
  const osFontScale = PixelRatio.getFontScale();
  const measureFontScale = osFontScale * e2eScale;
  /** Wait for real face width on native so we measure once at the final box. */
  const titleWidthReady = Platform.OS === 'web' || faceWidth > 0;
  /** Content width inside face padding (onLayout width includes padding). */
  const titleContentWidth = Math.max(
    0,
    (faceWidth > 0 ? faceWidth : CARD_FACE_FALLBACK_WIDTH) - facePad * 2,
  );
  const patternConceptKey = conceptKey(item.concept);
  const nativeCacheKey = nativeTitleMeasureCacheKey(
    title,
    titleContentWidth,
    measureFontScale,
  );

  // Reset / hydrate when title, width, or OS text scale changes (M1).
  useLayoutEffect(() => {
    setTitleInkSize(null);
    if (Platform.OS === 'web') return;
    if (!titleWidthReady) {
      setNativeTitleLayout(null);
      nativeFallbackVisibleRef.current = false;
      nativeMeasureAcceptedRef.current = null;
      return;
    }
    const cached = getCachedNativeTitleLayout(title, titleContentWidth, measureFontScale);
    setNativeTitleLayout(cached);
    nativeFallbackVisibleRef.current = false;
    nativeMeasureAcceptedRef.current = cached != null ? nativeCacheKey : null;
  }, [title, titleContentWidth, titleWidthReady, measureFontScale, nativeCacheKey]);

  // B2: if onTextLayout never fires, show approx layout after a short wait.
  useEffect(() => {
    if (Platform.OS === 'web' || !titleWidthReady || title.length === 0) return;
    if (getCachedNativeTitleLayout(title, titleContentWidth, measureFontScale) != null) {
      return;
    }
    const timer = setTimeout(() => {
      if (getCachedNativeTitleLayout(title, titleContentWidth, measureFontScale) != null) {
        return;
      }
      if (nativeMeasureAcceptedRef.current === nativeCacheKey) return;
      setNativeTitleLayout((prev) => {
        if (prev != null) return prev;
        nativeFallbackVisibleRef.current = true;
        return nativeTitleFallbackLayout(title, titleContentWidth, measureFontScale);
      });
    }, NATIVE_TITLE_MEASURE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [title, titleContentWidth, titleWidthReady, measureFontScale, nativeCacheKey]);

  const frontTitleLayout: ConceptFrontTitleLayout =
    Platform.OS === 'web'
      ? layoutConceptFrontTitle(
          title,
          titleContentWidth,
          measureConceptFrontTitleWidth,
          CONCEPT_FRONT_TITLE_FONT_SIZE,
          CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
          measureFontScale,
        )
      : (nativeTitleLayout ?? {
          displayText: title,
          fontSize: CONCEPT_FRONT_TITLE_FONT_SIZE,
          lineHeight: Math.round(
            CONCEPT_FRONT_TITLE_FONT_SIZE * CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
          ),
        });

  const titleOpacity: 0 | 1 =
    Platform.OS === 'web' ? 1 : nativeTitleLayout != null ? 1 : 0;
  /** Keep probing until the onTextLayout cache has this key (even after B2 fallback). */
  const cachedNativeLayout = getCachedNativeTitleLayout(
    title,
    titleContentWidth,
    measureFontScale,
  );
  const shouldProbeNative =
    Platform.OS !== 'web' &&
    titleWidthReady &&
    title.length > 0 &&
    cachedNativeLayout == null;
  void nativeCacheEpoch; // epoch bump re-renders so shouldProbe sees a filled cache

  const displayFontSize = Math.round(frontTitleLayout.fontSize * e2eScale);
  const displayLineHeight = Math.round(frontTitleLayout.lineHeight * e2eScale);
  const frontTitleColor = titleColor(
    conceptFrontTitleRenderedSize(frontTitleLayout.fontSize, measureFontScale),
  );
  /**
   * Scroll viewport ≈ face box minus padding. Spacer math and scroll-enable
   * must use this (not outer face height) so a band of ~2·facePad does not
   * leave overflow clipped with scrolling disabled (B2 / #95).
   */
  const frontContentFaceH =
    frontFaceH > 0 ? Math.max(0, frontFaceH - facePad * 2) : 0;
  const frontNeedsScroll =
    frontContentFaceH > 0 && frontContentH > frontContentFaceH + 0.5;
  const nativeProbeText = conceptFrontTitleNativeProbeText(title);

  useEffect(() => {
    if (flipProgressShared) return;
    flipProgress.value = withTiming(flipped ? 1 : 0, {
      duration: flipDurationMs(reduceMotion),
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, flipProgress, flipProgressShared, reduceMotion]);

  useAnimatedReaction(
    () => cardFlipA11yFace(flipProgress.value),
    (face, previous) => {
      if (face !== previous) runOnJS(setPresentedFace)(face);
    },
    [setPresentedFace],
  );

  // Before paint: avoids one post-paint frame where the old decoded flag pairs with a new URI.
  // Native: prefetched URLs are treated as ready so deck handoff never briefly resets.
  // Web: never trust prefetch — expo-image prefetch/onError miss 404s, and Playwright's
  // fake clock swallows the 8s decode timeout.
  useLayoutEffect(() => {
    setMediaSourceSize(null);
    setMediaSourceType(null);
    setBackTextBlockH(0);
    if (mediaUri.length === 0) {
      setMediaDecoded(true);
      setMediaError(false);
      return;
    }
    if (Platform.OS !== 'web' && isMediaPrefetched) {
      setMediaDecoded(true);
      setMediaError(false);
    } else {
      setMediaDecoded(false);
      setMediaError(false);
    }
  }, [mediaUri, isMediaPrefetched]);

  useEffect(() => {
    if (Platform.OS === 'web' || !mediaUri || mediaDecoded || mediaError) return;
    const handle = setTimeout(() => {
      setMediaError(true);
    }, CARD_BACK_MEDIA_DECODE_TIMEOUT_MS);
    return () => clearTimeout(handle);
  }, [mediaUri, mediaDecoded, mediaError]);

  // Web: fetch is a real network event (clock-safe). 404 / non-image → no-media back.
  useEffect(() => {
    if (Platform.OS !== 'web' || !mediaUri || mediaDecoded || mediaError) return;
    let cancelled = false;
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(mediaUri, {
          signal: ac.signal,
          credentials: 'omit',
        });
        if (cancelled) return;
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || (contentType.length > 0 && !contentType.startsWith('image/'))) {
          setMediaError(true);
          return;
        }
        setMediaDecoded(true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setMediaError(true);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [mediaUri, mediaDecoded, mediaError]);

  const frontFaceStyle = useAnimatedStyle(() => {
    const peek =
      flipProgress.value > 0.01 ? 0 : flipPeekSV.value * FLIP_COACH_PEEK_AMOUNT;
    const progress = Math.min(1, flipProgress.value + peek);
    return cardFlipFaceStyle(progress, 'front', reduceMotionSV.value > 0.5);
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const peek =
      flipProgress.value > 0.01 ? 0 : flipPeekSV.value * FLIP_COACH_PEEK_AMOUNT;
    const progress = Math.min(1, flipProgress.value + peek);
    return cardFlipFaceStyle(progress, 'back', reduceMotionSV.value > 0.5);
  });

  const onUntransformedFaceLayout = (event: {
    nativeEvent: { layout: { width: number; height: number } };
  }) => {
    const nextH = event.nativeEvent.layout.height;
    const nextW = event.nativeEvent.layout.width;
    // Flip rotateY can report a collapsed box; keep the last real face size
    // so no-media backs keep a measured ScrollView minHeight.
    if (nextH > 1) {
      setBackFaceH((prev) => (Math.abs(prev - nextH) < 0.5 ? prev : nextH));
      setFrontFaceH((prev) => (Math.abs(prev - nextH) < 0.5 ? prev : nextH));
    }
    if (nextW > 1) {
      setFaceWidth((prev) => (Math.abs(prev - nextW) < 0.5 ? prev : nextW));
    }
  };

  const patternFaceWidth = faceWidth > 0 ? faceWidth : CARD_FACE_FALLBACK_WIDTH;
  const patternFaceHeight = frontFaceH > 0 ? frontFaceH : Math.round(patternFaceWidth * (560 / 358));
  const titleLineCount = conceptFrontTitleLineCount(frontTitleLayout.displayText);
  const titleBlockH = conceptFrontTitleBlockHeight(frontTitleLayout, e2eScale);
  const titleViewportH = conceptFrontTitleViewportBlockHeight(frontTitleLayout, e2eScale);
  /**
   * AD #95: when overflowFallback exceeds max lines, size the top spacer so the
   * initial viewport shows at most 4 whole title lines; face scrolls for the rest.
   * ≤4 lines keep the lower-middle anchor against the full block height.
   */
  const frontTopSpacerH =
    frontContentFaceH > 0
      ? titleLineCount > CONCEPT_FRONT_TITLE_MAX_LINES
        ? conceptFrontTitleOverflowTopSpacerHeight(frontContentFaceH, titleViewportH)
        : conceptFrontTitleTopSpacerHeight(frontContentFaceH, titleBlockH)
      : undefined;
  /**
   * Pattern clear box in face pixels — the painted title ink + margin, never the
   * full-width Text box (§11.1 / §16.2). Falling back to column width hid the
   * edge-current chain beside short titles.
   */
  const titleInkWidth = conceptFrontTitleInkWidth(
    frontTitleLayout.displayText,
    displayFontSize,
  );
  const titleLayoutLooksFullBleed =
    titleInkSize != null && titleInkSize.width >= titleContentWidth - 1;
  const titleClearWidth = titleLayoutLooksFullBleed
    ? titleInkWidth
    : titleInkSize != null && titleInkSize.width > 0
      ? Math.min(titleInkSize.width, titleInkWidth > 0 ? titleInkWidth : titleInkSize.width)
      : titleInkWidth;
  const titleFaceRect: PatternRect | null =
    frontTopSpacerH != null && titleLineCount > 0 && titleClearWidth > 0
      ? {
          x: facePad,
          y: facePad + frontTopSpacerH,
          width: titleClearWidth,
          height: Math.max(titleBlockH, titleInkSize?.height ?? 0),
        }
      : null;
  const journeyTestParams = readJourneyTestParams();
  const patternVariantOverride = journeyTestParams.patternVariant ?? null;
  /**
   * Test-only `?e2ePadBand=1`: force content height to contentFace + facePad so it
   * lands in frontContentFaceH < content ≤ frontFaceH (B2 band), font-independent.
   */
  const e2ePadBandExtra =
    journeyTestParams.e2ePadBand && frontContentFaceH > 0 ? facePad : 0;
  const frontBottomSpacerMinH =
    frontContentFaceH > 0 && frontTopSpacerH != null
      ? conceptFrontTitleBottomSpacerMinHeight(
          frontContentFaceH,
          titleBlockH,
          frontTopSpacerH,
        )
      : CONCEPT_FRONT_TITLE_BOTTOM_RESERVE;
  const frontScrollMinH =
    frontContentFaceH > 0 ? frontContentFaceH + e2ePadBandExtra : 0;

  const front = (
    <View
      style={[styles.faceInner, styles.faceFrontInner, { padding: facePad, borderRadius: radius }]}
      onLayout={onUntransformedFaceLayout}
    >
      <PatternLayer
        conceptKey={patternConceptKey}
        faceWidth={patternFaceWidth}
        faceHeight={patternFaceHeight}
        titleFaceRect={titleFaceRect}
        facePad={facePad}
        exposeTestId={exposeFrontTitleTestId}
        variantOverride={patternVariantOverride}
        pulseGateActive={pulseGateActive && !flipped}
        frontScrolling={frontScrolling}
      />
      <ScrollView
        style={styles.frontScroll}
        contentContainerStyle={[
          styles.frontScrollContent,
          frontScrollMinH > 0 ? { minHeight: frontScrollMinH } : null,
        ]}
        scrollEnabled={frontNeedsScroll}
        showsVerticalScrollIndicator={false}
        bounces={frontNeedsScroll}
        testID="card-front-scroll"
        onScrollBeginDrag={() => setFrontScrolling(true)}
        onScrollEndDrag={() => setFrontScrolling(false)}
        onMomentumScrollBegin={() => setFrontScrolling(true)}
        onMomentumScrollEnd={() => setFrontScrolling(false)}
      >
        <View
          style={[
            styles.frontColumn,
            e2ePadBandExtra > 0 && frontScrollMinH > 0
              ? { minHeight: frontScrollMinH }
              : null,
          ]}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.height;
            setFrontContentH((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
          }}
        >
          <View
            style={[
              styles.frontTitleTopSpacer,
              frontTopSpacerH != null ? { height: frontTopSpacerH, flexGrow: 0 } : null,
            ]}
          />
          {shouldProbeNative ? (
            <Text
              // B1: unscaled probe widths — OS scale is applied once via measureFontScale.
              allowFontScaling={false}
              style={[
                styles.nativeTitleProbe,
                {
                  fontSize: CONCEPT_FRONT_TITLE_FONT_SIZE,
                  fontWeight: frontTitleBaseStyle.fontWeight,
                },
              ]}
              onTextLayout={(event) => {
                const key = nativeCacheKey;
                if (nativeMeasureAcceptedRef.current === key) return;
                const result = applyNativeTitleTextLayoutOnce({
                  title,
                  maxWidth: titleContentWidth,
                  lines: event.nativeEvent.lines.map((line) => ({
                    text: line.text,
                    width: line.width,
                  })),
                  probeFontSize: CONCEPT_FRONT_TITLE_FONT_SIZE,
                  fontScale: measureFontScale,
                });
                if (!result.applied) return;
                nativeMeasureAcceptedRef.current = key;
                // Fallback already on screen: cache only — do not resize (clarification).
                if (!shouldCommitNativeTitleLayoutToView(nativeFallbackVisibleRef.current)) {
                  setNativeCacheEpoch((epoch) => epoch + 1);
                  return;
                }
                setNativeTitleLayout(result.layout);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {nativeProbeText}
            </Text>
          ) : null}
          <Text
            style={[
              styles.conceptNameFront,
              {
                // Web: pin the same stack measureConceptFrontTitleWidth uses (RN Web System).
                // Native: leave unset so the platform system sans applies.
                ...(Platform.OS === 'web' ? { fontFamily: CONCEPT_FRONT_TITLE_FONT_STACK } : null),
                fontSize: displayFontSize,
                lineHeight: displayLineHeight,
                fontWeight: frontTitleBaseStyle.fontWeight,
                color: frontTitleColor,
                // Native: opacity 0 until measured — first visible frame is final size (no jump).
                opacity: titleOpacity,
              },
            ]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setTitleInkSize((prev) => {
                if (
                  prev &&
                  Math.abs(prev.width - width) < 0.5 &&
                  Math.abs(prev.height - height) < 0.5
                ) {
                  return prev;
                }
                return { width, height };
              });
            }}
            testID={exposeFrontTitleTestId ? 'card-front-title' : undefined}
            accessibilityRole="header"
            accessibilityLabel={title}
          >
            {frontTitleLayout.displayText}
          </Text>
          <View
            style={[
              styles.frontTitleBottomSpacer,
              { minHeight: frontBottomSpacerMinH },
            ]}
          />
          {e2ePadBandExtra > 0 ? (
            <View
              testID={exposeFrontTitleTestId ? 'card-front-pad-band-end' : undefined}
              style={{ width: 1, height: 1, opacity: 0 }}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );

  const mediaPhase = resolveCardBackMediaPhase({
    hasMediaUrl: mediaUri.length > 0,
    decoded: mediaDecoded,
    failed: mediaError,
  });
  const phaseLayout = composeCardBackLayout(mediaPhase);
  // Reserve guide face padding under copy so the 28% band scrolls instead of
  // pinning Wikipedia / description against the card edge (art director B2).
  const mediaBand = resolveCardBackMediaBand(backFaceH, backTextBlockH, facePad);
  const backLayout: CardBackLayout =
    phaseLayout.showMediaZone && mediaBand.dropImage
      ? composeCardBackLayout('failed')
      : phaseLayout;
  const { rhythm } = backLayout;
  const showMediaLayer = backLayout.showMediaZone && !mediaBand.dropImage;
  const bandHeight = showMediaLayer ? mediaBand.bandHeight : 0;
  const mediaSlotWidth = faceWidth > 0 ? faceWidth : 0;
  const fitPlan = resolveCardBackMediaFit({
    mediaUrl: item.mediaUrl ?? '',
    purpose: creditedMedia?.purpose,
    sourceWidth: mediaSourceSize?.width,
    sourceHeight: mediaSourceSize?.height,
    mediaType: mediaSourceType,
    slotWidth: mediaSlotWidth,
    slotHeight: bandHeight,
  });
  const contentFit = fitPlan.contentFit;
  const fade = resolveCardBackMediaFade({
    bandHeight,
    faceHeight: backFaceH,
    contentFit,
    tone: creditedMedia?.tone,
  });
  const readingPadTop =
    showMediaLayer && bandHeight > 0
      ? fade.kind === 'none'
        ? bandHeight
        : Math.max(0, bandHeight - CARD_BACK_MEDIA_SEAM_OVERLAP)
      : 0;
  const coverPosition = coverContentPosition(creditedMedia?.focalX, creditedMedia?.focalY);
  const imageTransition = reduceMotion ? 0 : CARD_BACK_MEDIA_FADE_IN_MS;
  const containBox =
    contentFit === 'contain' &&
    mediaSourceSize != null &&
    mediaSlotWidth > 0 &&
    bandHeight > 0
      ? resolveContainMediaBox({
          sourceWidth: mediaSourceSize.width,
          sourceHeight: mediaSourceSize.height,
          slotWidth: mediaSlotWidth,
          slotHeight: bandHeight,
        })
      : null;
  const scrollContentStyle = cardBackScrollContentStyle(
    showMediaLayer ? backFaceH - readingPadTop - facePad : backFaceH,
    showMediaLayer ? 0 : facePad,
    rhythm.scrollJustify,
  );

  // Apply via textStyle so ?e2eTextScale=2 reaches the back (rhythm constants are unscaled).
  const backBodyType = textStyle('body');
  const e2eTextScaleFactor = Math.max(
    1,
    ((backBodyType.fontSize as number) ?? rhythm.descriptionFontSize) /
      rhythm.descriptionFontSize,
  );
  const backLinkFontSize = Math.round(16 * e2eTextScaleFactor);

  const measureFirstTextLine = () => {
    if (showMediaLayer) return;
    const desc = backDescRef.current;
    const face = backFaceRef.current;
    if (!desc || !face || typeof desc.measureLayout !== 'function') return;
    desc.measureLayout(
      face,
      (_x, y) => {
        if (!Number.isFinite(y)) return;
        setFirstTextY((prev) => (prev != null && Math.abs(prev - y) < 0.5 ? prev : y));
      },
      () => {},
    );
  };

  useEffect(() => {
    if (!flipped || showMediaLayer) return;
    const id = requestAnimationFrame(() => measureFirstTextLine());
    return () => cancelAnimationFrame(id);
  }, [flipped, showMediaLayer, title]);

  const backDescription = (
    <Text
      ref={backDescRef}
      onLayout={measureFirstTextLine}
      style={[
        styles.description,
        {
          fontSize: backBodyType.fontSize,
          lineHeight: backBodyType.lineHeight,
          marginBottom: rhythm.descriptionMarginBottom,
        },
      ]}
      testID="card-back-description"
    >
      {item.shortDescription || t('noDescription')}
    </Text>
  );

  // 48 px target via hitSlop only — minHeight would pad the visible underline past the
  // guide’s 20–24 px gap under the paragraph (art director / Lz-27 AC1).
  const linkHitSlop = Math.max(0, Math.ceil((LINK_HIT - backLinkFontSize) / 2));
  const creditMetaType = textStyle('meta');
  const licenceFontSize = Math.round(
    ((creditMetaType.fontSize as number) || 13) * osFontScale,
  );
  const licenceHitSlop = cardBackLicenceHitSlop(licenceFontSize);
  const openWiki = () => {
    onBackInteractivePress?.();
    void Linking.openURL(item.wikiUrl!);
  };
  // RN-web Pressable does not activate role=link on Enter; handle keys so the
  // focused back link opens without bubbling a flip to the card surface.
  const wikiWebKeyProps =
    Platform.OS === 'web'
      ? ({
          onKeyDown: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void; stopPropagation?: () => void }) => {
            const key = event.nativeEvent?.key;
            if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
            event.preventDefault?.();
            event.stopPropagation?.();
            openWiki();
          },
        } as Record<string, unknown>)
      : {};
  // When the front is up the card surface is one button — do not mount a nested
  // link (Lz-41 axe nested-interactive). Paint a non-interactive twin for flip.
  const showReferenceLinks = resolveShowReferenceLinks(journeyTestParams);
  const showMediaCredits = resolveShowMediaCredits(journeyTestParams);
  const backWiki = showReferenceLinks && item.wikiUrl ? (
    presentedFace === 'back' ? (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('wikipedia')}
        onPressIn={onBackInteractivePress}
        onPress={openWiki}
        hitSlop={{ top: linkHitSlop, bottom: linkHitSlop, left: 8, right: 8 }}
        style={[styles.linkHit, { marginTop: rhythm.linkMarginTop }]}
        testID="card-back-wikipedia"
        {...wikiWebKeyProps}
      >
        <Text style={[styles.link, { fontSize: backLinkFontSize }]}>{t('wikipedia')}</Text>
      </Pressable>
    ) : (
      <View
        style={[styles.linkHit, { marginTop: rhythm.linkMarginTop }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
      >
        <Text style={[styles.link, { fontSize: backLinkFontSize }]} accessible={false}>
          {t('wikipedia')}
        </Text>
      </View>
    )
  ) : null;

  // Credit only the displayed asset; other graph media may belong to a different locale.
  const creditModel = resolveCardBackCredit(
    creditedMedia,
    item.mediaUrl,
    t('wikimediaCommons'),
  );
  const changeNoticeLabel = creditModel.changeNoticeKey
    ? t(
        creditModel.changeNoticeKey === 'cropped'
          ? 'changeNoticeCropped'
          : 'changeNoticeResized',
      )
    : creditModel.changeNoticeRaw;
  const creditLead = creditModel.creator
    ? t('imageCredit', { credit: creditModel.creator })
    : '';
  const openLicence = () => {
    if (!creditModel.licenceUrl) return;
    onBackInteractivePress?.();
    void Linking.openURL(creditModel.licenceUrl);
  };
  const licenceWebKeyProps =
    Platform.OS === 'web'
      ? ({
          onKeyDown: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void; stopPropagation?: () => void }) => {
            const key = event.nativeEvent?.key;
            if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
            event.preventDefault?.();
            event.stopPropagation?.();
            openLicence();
          },
        } as Record<string, unknown>)
      : {};
  const licenceNameNode = creditModel.licenceName
    ? flipped && creditModel.licenceUrl
      ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('licenceLinkA11y', { name: creditModel.licenceName })}
            onPressIn={onBackInteractivePress}
            onPress={openLicence}
            hitSlop={{ top: licenceHitSlop, bottom: licenceHitSlop, left: 8, right: 8 }}
            style={styles.linkHit}
            testID="card-back-licence"
            {...licenceWebKeyProps}
          >
            <Text style={[textStyle('meta'), styles.creditInk]}>{creditModel.licenceName}</Text>
          </Pressable>
        )
      : (
          <Text
            testID="card-back-licence"
            style={[textStyle('meta'), styles.creditInk]}
            accessible={flipped}
            accessibilityElementsHidden={!flipped}
          >
            {creditModel.licenceName}
          </Text>
        )
    : null;
  const backCredit =
    showMediaCredits && showMediaLayer && creditedMedia && cardBackCreditHasRow(creditModel) ? (
      <View
        onTouchStart={onBackInteractivePress}
        onPointerDown={onBackInteractivePress}
        style={styles.credit}
      >
        <View
          style={styles.creditRow}
          testID="card-back-credit"
        >
          {creditLead ? (
            <Text style={[textStyle('meta'), styles.creditInk]}>{creditLead}</Text>
          ) : null}
          {creditLead && licenceNameNode ? (
            <Text style={[textStyle('meta'), styles.creditInk]}>{' · '}</Text>
          ) : null}
          {licenceNameNode}
          {changeNoticeLabel ? (
            <Text style={[textStyle('meta'), styles.creditInk]}>{` · ${changeNoticeLabel}`}</Text>
          ) : null}
        </View>
      </View>
    ) : null;

  const informativeAlt = resolveInformativeAlt(
    creditedMedia?.purpose,
    creditedMedia?.alt,
    item.shortDescription,
  );
  const backAlt = informativeAlt ? (
    <Text
      testID="card-back-media-alt"
      style={styles.srOnlyAbout}
      accessibilityRole="text"
    >
      {informativeAlt}
    </Text>
  ) : null;

  const backCopy = (
    <View
      style={styles.copyCluster}
      testID="card-back-copy"
      onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setBackTextBlockH((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
      }}
    >
      {backDescription}
      {backAlt}
      {backWiki}
      {backCredit}
    </View>
  );

  const onMediaLoad = (event: {
    source?: { width?: number; height?: number; mediaType?: string | null };
  }) => {
    const src = event.source;
    if (src?.width && src?.height) {
      setMediaSourceSize({ width: src.width, height: src.height });
    }
    setMediaSourceType(src?.mediaType ?? null);
    setMediaDecoded(true);
    setMediaError(false);
  };
  const showVisibleMediaImage = Boolean(
    showMediaLayer && backLayout.showMediaImage && imageSource,
  );
  const showMediaDecoder = Boolean(
    Platform.OS !== 'web' &&
      mediaUri.length > 0 &&
      imageSource &&
      !showVisibleMediaImage &&
      !mediaError,
  );

  const backMediaLayer =
    showMediaLayer && imageSource ? (
      <View
        style={[styles.mediaLayer, { height: bandHeight > 0 ? bandHeight : '28%' }]}
        testID="card-back-media"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web'
          ? ({
              'aria-hidden': true,
              dataSet: {
                mediaFit: contentFit,
                mediaFitReason: fitPlan.reason,
                mediaFade: fade.kind,
              },
            } as Record<string, unknown>)
          : null)}
      >
        {showVisibleMediaImage ? (
          contentFit === 'contain' ? (
            <Image
              source={imageSource}
              style={
                containBox != null && containBox.width > 0
                  ? {
                      position: 'absolute',
                      width: containBox.width,
                      height: containBox.height,
                      left: containBox.left,
                      top: containBox.top,
                    }
                  : styles.mediaContainPending
              }
              contentFit="contain"
              contentPosition={CARD_BACK_MEDIA_CONTENT_POSITION}
              cachePolicy="memory-disk"
              recyclingKey={mediaUri}
              priority="high"
              transition={imageTransition}
              onLoad={onMediaLoad}
              onError={() => {
                setMediaError(true);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : (
            <Image
              source={imageSource}
              style={StyleSheet.absoluteFill}
              contentFit={CARD_BACK_MEDIA_CONTENT_FIT}
              contentPosition={coverPosition}
              cachePolicy="memory-disk"
              recyclingKey={mediaUri}
              priority="high"
              transition={imageTransition}
              onLoad={onMediaLoad}
              onError={() => {
                setMediaError(true);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )
        ) : null}
        {fade.kind !== 'none' && fade.height > 0 ? (
          <View
            style={[styles.mediaFade, { top: fade.startY, height: fade.height }]}
            pointerEvents="none"
            testID="card-back-media-fade"
            {...(Platform.OS === 'web'
              ? ({ dataSet: { mediaFade: fade.kind } } as Record<string, unknown>)
              : null)}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="cardBackPaperFade" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={color.paper} stopOpacity="0" />
                  <Stop offset="70%" stopColor={color.paper} stopOpacity="0.85" />
                  <Stop offset="100%" stopColor={color.paper} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#cardBackPaperFade)" />
            </Svg>
          </View>
        ) : null}
      </View>
    ) : null;

  /**
   * One ScrollView for both branches (Lz-27 / Lz-28). Measured minHeight from the
   * untransformed front keeps flex-end/flex-start real under the flip on RN Web.
   * Media is a full-bleed layer under the paper reading block — not an inner box.
   */
  const showBlindEmboss = !showMediaLayer && faceWidth >= 8 && backFaceH >= 8;
  const embossPlan = resolveNoMediaEmbossHeight({
    cardHeight: backFaceH,
    firstTextY,
  });
  const embossXml = useMemo(() => {
    if (!showBlindEmboss) return '';
    return buildNoMediaEmbossXml(
      buildPatternSvgXml({
        conceptKey: patternConceptKey,
        titleFaceRect: null,
        faceWidth,
        faceHeight: backFaceH,
        variantOverride: patternVariantOverride,
      }).xml,
    );
  }, [showBlindEmboss, patternConceptKey, faceWidth, backFaceH, patternVariantOverride]);

  const back = (
    <View
      ref={backFaceRef}
      style={[
        styles.faceInner,
        styles.faceBackInner,
        showMediaLayer ? styles.faceBackInnerMedia : styles.faceBackInnerEmboss,
        { borderRadius: radius },
        showMediaLayer ? null : { padding: facePad },
      ]}
      // Single AT name via sr-only heading below — no wrapper aria-label (Lz-41 / CI strict).
      testID={`card-back-${backLayout.mode}`}
    >
      {showBlindEmboss ? (
        <NoMediaEmboss
          xml={embossXml}
          width={faceWidth}
          height={embossPlan.height}
          faceHeight={backFaceH}
          fadeStart={embossPlan.fadeStart}
        />
      ) : null}
      <Text
        accessibilityRole="header"
        accessibilityLabel={t('aboutConcept', { concept: title })}
        style={styles.srOnlyAbout}
        testID="card-back-about"
      >
        {t('aboutConcept', { concept: title })}
      </Text>
      {backMediaLayer}
      <AnimatedScrollView
        style={[
          styles.backScroll,
          // Keep the image/fade outside the reading scroll viewport. Scrolling
          // overflowing copy must not slide opaque paper over the media band.
          showMediaLayer ? { marginTop: readingPadTop, backgroundColor: color.paper } : null,
        ]}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
        bounces
        nestedScrollEnabled
        testID="card-back-scroll"
        scrollEventThrottle={16}
        onScroll={onBackScroll}
        onLayout={(event) => {
          scrollViewportH.value = event.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_w, h) => {
          scrollContentH.value = h;
        }}
      >
        <View
          style={[
            styles.backInner,
            showMediaLayer ? styles.backReadingOnPaper : null,
            // paddingTop on the paper block covers the seam overlap so ink still
            // clears the fade; a fixed spacer below the scroller holds the bottom inset.
            showMediaLayer
              ? {
                  paddingHorizontal: facePad,
                  paddingTop: fade.kind === 'none' ? 0 : CARD_BACK_MEDIA_SEAM_OVERLAP,
                  paddingBottom: 0,
                }
              : null,
            backLayout.expandMediaZone ? styles.backInnerExpand : null,
          ]}
        >
          {backCopy}
        </View>
      </AnimatedScrollView>
      {showMediaLayer ? (
        <View
          style={{ height: facePad, backgroundColor: color.paper }}
          testID="card-back-reading-inset"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  );

  const frontA11yHidden = presentedFace === 'back';
  const backA11yHidden = presentedFace === 'front';

  return (
    <View
      style={styles.card}
      accessibilityHint={accessibilityHint}
      accessible={accessibilityHint != null ? true : undefined}
    >
      {showMediaDecoder ? (
        <Image
          source={imageSource}
          style={styles.mediaDecoder}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`${mediaUri}-decoder`}
          priority="high"
          transition={0}
          testID="card-back-media-decoder"
          onLoad={onMediaLoad}
          onError={() => {
            setMediaError(true);
          }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={[styles.face, { borderRadius: radius }, CARD_SHADOW]}>
        <View style={styles.flipRoot}>
          <Animated.View
            style={[styles.faceSide, styles.faceFront, frontFaceStyle]}
            pointerEvents={presentedFace === 'back' ? 'none' : 'auto'}
            accessibilityElementsHidden={frontA11yHidden}
            importantForAccessibility={frontA11yHidden ? 'no-hide-descendants' : 'auto'}
            {...(Platform.OS === 'web' ? { 'aria-hidden': frontA11yHidden } : null)}
          >
            {front}
          </Animated.View>
          <Animated.View
            style={[styles.faceSide, styles.faceBack, backFaceStyle]}
            pointerEvents={presentedFace === 'back' ? 'auto' : 'none'}
            accessibilityElementsHidden={backA11yHidden}
            importantForAccessibility={backA11yHidden ? 'no-hide-descendants' : 'auto'}
            {...(Platform.OS === 'web' ? { 'aria-hidden': backA11yHidden } : null)}
          >
            {back}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  /** AT-only “About <concept>” (Lz-41); clipped so captures stay unchanged. */
  srOnlyAbout: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    opacity: 0,
    zIndex: 0,
  },
  /**
   * Off-screen decoder. Unmounted once the visible back image is showing so
   * native never has two expo-image views of the same URI (Lz-55). 1×1 so the
   * native/web loader actually runs (0×0 can skip decode and miss onError).
   */
  mediaDecoder: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -4096,
    top: 0,
    zIndex: 0,
  },
  face: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  flipRoot: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  faceSide: {
    ...StyleSheet.absoluteFill,
  },
  faceFront: {
    zIndex: 2,
  },
  faceBack: {
    zIndex: 1,
  },
  faceInner: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  faceFrontInner: {
    backgroundColor: color.front,
  },
  faceBackInner: {
    backgroundColor: color.paper,
  },
  faceBackInnerEmboss: {
    overflow: 'hidden',
  },
  /** Edge-to-edge media under the reading block; padding lives on the copy. */
  faceBackInnerMedia: {
    overflow: 'hidden',
    padding: 0,
  },
  backScroll: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  backInner: {
    width: '100%',
    zIndex: 1,
  },
  /** Solid paper under copy so ink never sits on the photo fade. */
  backReadingOnPaper: {
    backgroundColor: color.paper,
  },
  /** With-media only: reading rhythm stays top-stacked under the band. */
  backInnerExpand: {
    flexGrow: 1,
  },
  mediaLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: color.paper,
    overflow: 'hidden',
    zIndex: 0,
  },
  mediaFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  /** 16 px inset contain while source dimensions are still unknown. */
  mediaContainPending: {
    position: 'absolute',
    top: 16,
    right: 16,
    bottom: 16,
    left: 16,
  },
  copyCluster: {
    width: '100%',
  },
  frontScroll: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  frontScrollContent: {
    flexGrow: 1,
  },
  frontColumn: {
    width: '100%',
    flexGrow: 1,
  },
  /** Pushes the title into the lower-middle clear area (~52% first baseline). */
  frontTitleTopSpacer: {
    flexGrow: 1,
    width: '100%',
  },
  /** Off-screen probe for one native onTextLayout; never visible. */
  nativeTitleProbe: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    width: 4096,
    zIndex: -1,
  },
  /** Room below short titles; long titles collapse minHeight then the face scrolls. */
  frontTitleBottomSpacer: {
    flexGrow: 1,
    width: '100%',
  },
  conceptNameFront: {
    /**
     * Ink-hugging box for Lz-25 clear (title + 16 px). `maxWidth: '100%'` still
     * wraps at the column; `width: '100%'` would clear the whole face and hide
     * edge-current motifs beside a short title.
     */
    alignSelf: 'flex-start',
    maxWidth: '100%',
    textAlign: CONCEPT_FRONT_TITLE_TEXT_ALIGN,
    flexShrink: 0,
    // Honour explicit `\n` / `-\n` from layoutConceptFrontTitle.
    // pre-wrap keeps the trailing space on soft wraps (pre-line collapses it,
    // which made M1 see `conceptual\nmulti…` as a bare mid-word break).
    // Override RN Web Text's default wordWrap:'break-word' so the engine
    // never splits a word unless we inserted a visible hyphen.
    ...Platform.select({
      web: {
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'normal' as const,
        wordWrap: 'normal' as const,
        overflowWrap: 'normal' as const,
      },
      default: {},
    }),
  },
  description: {
    color: color.ink,
  },
  credit: {
    marginTop: 12,
  },
  creditRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  creditInk: {
    color: color.mutedOnPaper,
  },
  linkHit: {
    alignSelf: 'flex-start',
  },
  link: {
    fontSize: 16,
    color: color.ink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
