import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  interpolate,
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
  CARD_BACK_MEDIA_SEAM_OVERLAP,
  resolveCardBackMediaBand,
  resolveCardBackMediaFade,
  resolveCardBackMediaFit,
  resolveContainMediaBox,
} from '@/lib/cardBackMedia';
import { CARD_SHADOW, cardPadding, cardRadius } from '@/lib/cardLayout';
import {
  CONCEPT_FRONT_TITLE_FONT_SIZE,
  CONCEPT_FRONT_TITLE_FONT_STACK,
  CONCEPT_FRONT_TITLE_LINE_HEIGHT_RATIO,
  CONCEPT_FRONT_TITLE_MIN_ON_ORANGE,
  CONCEPT_FRONT_TITLE_TEXT_ALIGN,
  NATIVE_TITLE_MEASURE_FALLBACK_MS,
  applyNativeTitleTextLayoutOnce,
  conceptFrontTitleLineCount,
  conceptFrontTitleNativeProbeText,
  conceptFrontTitleRenderedSize,
  conceptFrontTitleTopSpacerHeight,
  getCachedNativeTitleLayout,
  layoutConceptFrontTitle,
  measureConceptFrontTitleWidth,
  nativeTitleFallbackLayout,
  nativeTitleMeasureCacheKey,
  shouldCommitNativeTitleLayoutToView,
  titleColor,
  type ConceptFrontTitleLayout,
  type ConceptFrontTitleRect,
} from '@/lib/conceptFrontTitle';
import { CoachHint } from './CoachHint';
import { ConceptCardBrandTexture } from './ConceptCardBrandTexture';
import { CARD_BRAND_FALLBACK_FACE_WIDTH } from '@/lib/conceptCardBrand';
import { FLIP_COACH_PEEK_AMOUNT } from '@/lib/discoveryCoaching';
import { t } from '@/lib/i18n';
import { remoteImageSource } from '@/lib/remoteImage';

const FLIP_MS = 420;
const LINK_HIT = layout.recommendedTouchTarget;

function capitalizeFirstLetter(text: string) {
  if (!text.length) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type ConceptCardProps = {
  item: ConceptItem;
  flipped: boolean;
  /** True when this URL was successfully prefetched (smoother reveal, shorter transition). */
  isMediaPrefetched: boolean;
  /** Momentary coaching copy on the front face; omit after the gesture is discovered. */
  coachHint?: string | null;
  /** Fade/slide the coach in. False under reduced motion (text-only). */
  animateCoachAppear?: boolean;
  /** 0–1 light flip peek for coaching; ignored once the card is actually flipped. */
  flipPeek?: SharedValue<number>;
  /**
   * Only the interactive front-of-stack card should expose `card-front-title`
   * (behind / return-overlay duplicates must not, or Playwright strict mode fails).
   */
  exposeFrontTitleTestId?: boolean;
};

export function ConceptCard({
  item,
  flipped,
  isMediaPrefetched,
  coachHint,
  animateCoachAppear = true,
  flipPeek,
  exposeFrontTitleTestId = false,
}: ConceptCardProps) {
  const title = capitalizeFirstLetter(item.concept);
  const imageSource = remoteImageSource(item.mediaUrl, Platform.OS, resolveApiBaseUrl());
  const mediaUri = imageSource?.uri ?? '';
  const { width: windowWidth } = useWindowDimensions();
  const facePad = cardPadding(windowWidth);
  const radius = cardRadius();

  const [mediaDecoded, setMediaDecoded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaSourceSize, setMediaSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [backFaceH, setBackFaceH] = useState(0);
  const [faceWidth, setFaceWidth] = useState(0);
  const [frontFaceH, setFrontFaceH] = useState(0);
  const [frontContentH, setFrontContentH] = useState(0);
  const [backTextBlockH, setBackTextBlockH] = useState(0);
  /**
   * Native: committed visible layout (onTextLayout or B2 fallback).
   * Web uses sync DOM measure and never touches this.
   */
  const [nativeTitleLayout, setNativeTitleLayout] = useState<ConceptFrontTitleLayout | null>(
    null,
  );
  /** Bumps when late onTextLayout fills the cache without resizing (unmount probe). */
  const [nativeCacheEpoch, setNativeCacheEpoch] = useState(0);
  /** Measured title box for Lz-25 pattern clearing (column-local coords). */
  const titleRectRef = useRef<ConceptFrontTitleRect | null>(null);
  /** Cache key already written from onTextLayout (ignore further probe events). */
  const nativeMeasureAcceptedRef = useRef<string | null>(null);
  /** True once B2 fallback is painted — late onTextLayout must not resize. */
  const nativeFallbackVisibleRef = useRef(false);
  /** 0 = front, 1 = back — opacity + rotate crossfade (reliable vs single rotateY + overflow on RN). */
  const flipProgress = useSharedValue(0);
  const fallbackFlipPeek = useSharedValue(0);
  const flipPeekSV = flipPeek ?? fallbackFlipPeek;

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
    (faceWidth > 0 ? faceWidth : CARD_BRAND_FALLBACK_FACE_WIDTH) - facePad * 2,
  );
  const nativeCacheKey = nativeTitleMeasureCacheKey(
    title,
    titleContentWidth,
    measureFontScale,
  );

  // Reset / hydrate when title, width, or OS text scale changes (M1).
  useLayoutEffect(() => {
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
  const frontNeedsScroll = frontFaceH > 0 && frontContentH > frontFaceH + 0.5;
  const nativeProbeText = conceptFrontTitleNativeProbeText(title);

  useEffect(() => {
    flipProgress.value = withTiming(flipped ? 1 : 0, {
      duration: FLIP_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, flipProgress]);

  // Before paint: avoids one post-paint frame where the old decoded flag pairs with a new URI.
  // Prefetched URLs are treated as ready so deck handoff (same card promoted from behind → front) never briefly resets.
  useLayoutEffect(() => {
    setMediaSourceSize(null);
    setBackTextBlockH(0);
    if (mediaUri.length === 0) {
      setMediaDecoded(true);
      setMediaError(false);
      return;
    }
    if (isMediaPrefetched) {
      setMediaDecoded(true);
      setMediaError(false);
    } else {
      setMediaDecoded(false);
      setMediaError(false);
    }
  }, [mediaUri, isMediaPrefetched]);

  const frontFaceStyle = useAnimatedStyle(() => {
    const peek =
      flipProgress.value > 0.01 ? 0 : flipPeekSV.value * FLIP_COACH_PEEK_AMOUNT;
    const progress = Math.min(1, flipProgress.value + peek);
    const rot = interpolate(progress, [0, 1], [0, -90]);
    return {
      opacity: interpolate(progress, [0, 0.48, 0.52, 1], [1, 1, 0, 0]),
      transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
    };
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const peek =
      flipProgress.value > 0.01 ? 0 : flipPeekSV.value * FLIP_COACH_PEEK_AMOUNT;
    const progress = Math.min(1, flipProgress.value + peek);
    const rot = interpolate(progress, [0, 1], [90, 0]);
    return {
      opacity: interpolate(progress, [0, 0.48, 0.52, 1], [0, 0, 1, 1]),
      transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
    };
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

  const brandFaceWidth = faceWidth > 0 ? faceWidth : CARD_BRAND_FALLBACK_FACE_WIDTH;
  const titleLineCount = conceptFrontTitleLineCount(frontTitleLayout.displayText);
  const titleBlockH = titleLineCount * displayLineHeight;
  /** Prefer lower-middle anchor; shrink so long titles rise and never clip. */
  const frontTopSpacerH =
    frontFaceH > 0
      ? conceptFrontTitleTopSpacerHeight(frontFaceH, titleBlockH)
      : undefined;

  const front = (
    <View
      style={[styles.faceInner, styles.faceFrontInner, { padding: facePad, borderRadius: radius }]}
      onLayout={onUntransformedFaceLayout}
    >
      <ConceptCardBrandTexture face="front" faceWidth={brandFaceWidth} />
      <ScrollView
        style={styles.frontScroll}
        contentContainerStyle={[
          styles.frontScrollContent,
          frontFaceH > 0 ? { minHeight: frontFaceH } : null,
        ]}
        scrollEnabled={frontNeedsScroll}
        showsVerticalScrollIndicator={false}
        bounces={frontNeedsScroll}
        testID="card-front-scroll"
      >
        <View
          style={styles.frontColumn}
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
              const { x, y, width, height } = event.nativeEvent.layout;
              titleRectRef.current = { x, y, width, height };
            }}
            testID={exposeFrontTitleTestId ? 'card-front-title' : undefined}
            accessibilityRole="header"
            accessibilityLabel={title}
          >
            {frontTitleLayout.displayText}
          </Text>
          <View style={styles.frontTitleBottomSpacer} />
        </View>
      </ScrollView>
      {coachHint ? (
        <CoachHint text={coachHint} animateAppear={animateCoachAppear} surface="orange" />
      ) : null}
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
  const fade = resolveCardBackMediaFade(bandHeight);
  const readingPadTop =
    showMediaLayer && bandHeight > 0
      ? Math.max(0, bandHeight - CARD_BACK_MEDIA_SEAM_OVERLAP)
      : 0;
  const mediaSlotWidth = faceWidth > 0 ? faceWidth : 0;
  const fitPlan = resolveCardBackMediaFit({
    mediaUrl: item.mediaUrl ?? '',
    sourceWidth: mediaSourceSize?.width,
    sourceHeight: mediaSourceSize?.height,
    slotWidth: mediaSlotWidth,
    slotHeight: bandHeight,
  });
  const contentFit = fitPlan.contentFit;
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
    backFaceH,
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

  const backDescription = (
    <Text
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
  const backWiki = item.wikiUrl ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('wikipedia')}
      onPress={() => Linking.openURL(item.wikiUrl!)}
      hitSlop={{ top: linkHitSlop, bottom: linkHitSlop, left: 8, right: 8 }}
      style={[styles.linkHit, { marginTop: rhythm.linkMarginTop }]}
      testID="card-back-wiki"
    >
      <Text style={[styles.link, { fontSize: backLinkFontSize }]}>{t('wikipedia')}</Text>
    </Pressable>
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
      {backWiki}
    </View>
  );

  const backMediaLayer =
    showMediaLayer && imageSource ? (
      <View
        style={[styles.mediaLayer, { height: bandHeight > 0 ? bandHeight : '28%' }]}
        testID="card-back-media"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? { 'aria-hidden': true } : null)}
      >
        {backLayout.showMediaImage ? (
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
              priority="high"
              transition={0}
              onLoad={(event) => {
                const src = event.source;
                if (src?.width && src?.height) {
                  setMediaSourceSize({ width: src.width, height: src.height });
                }
                setMediaDecoded(true);
                setMediaError(false);
              }}
              onLoadEnd={() => {
                setMediaDecoded(true);
              }}
              onError={() => {
                setMediaError(true);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : (
            <Image
              source={imageSource}
              style={StyleSheet.absoluteFillObject}
              contentFit={CARD_BACK_MEDIA_CONTENT_FIT}
              contentPosition={CARD_BACK_MEDIA_CONTENT_POSITION}
              cachePolicy="memory-disk"
              priority="high"
              transition={0}
              onLoad={(event) => {
                const src = event.source;
                if (src?.width && src?.height) {
                  setMediaSourceSize({ width: src.width, height: src.height });
                }
                setMediaDecoded(true);
                setMediaError(false);
              }}
              onLoadEnd={() => {
                setMediaDecoded(true);
              }}
              onError={() => {
                setMediaError(true);
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )
        ) : null}
        {fade.height > 0 ? (
          <View
            style={[styles.mediaFade, { top: fade.startY, height: fade.height }]}
            pointerEvents="none"
            testID="card-back-media-fade"
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
   * untransformed front keeps center/flex-start real under the flip on RN Web.
   * Media is a full-bleed layer under the paper reading block — not an inner box.
   */
  const back = (
    <View
      style={[
        styles.faceInner,
        styles.faceBackInner,
        showMediaLayer ? styles.faceBackInnerMedia : null,
        { borderRadius: radius },
        showMediaLayer ? null : { padding: facePad },
      ]}
      accessibilityLabel={t('aboutConcept', { concept: title })}
      testID={`card-back-${backLayout.mode}`}
    >
      {backMediaLayer}
      <ScrollView
        style={styles.backScroll}
        contentContainerStyle={[
          scrollContentStyle,
          readingPadTop > 0 ? { paddingTop: readingPadTop } : null,
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        nestedScrollEnabled
        testID="card-back-scroll"
      >
        <View
          style={[
            styles.backInner,
            showMediaLayer ? styles.backReadingOnPaper : null,
            // paddingTop on the paper block covers the seam overlap so ink still
            // clears the fade; paddingBottom holds the guide 24/20 inset.
            showMediaLayer
              ? {
                  paddingHorizontal: facePad,
                  paddingTop: CARD_BACK_MEDIA_SEAM_OVERLAP,
                  paddingBottom: facePad,
                }
              : null,
            backLayout.expandMediaZone ? styles.backInnerExpand : null,
          ]}
        >
          {backCopy}
        </View>
      </ScrollView>
    </View>
  );

  const frontA11yHidden = flipped;
  const backA11yHidden = !flipped;

  return (
    <View style={styles.card}>
      {mediaUri.length > 0 && imageSource ? (
        <Image
          source={imageSource}
          style={styles.eagerPreload}
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
          onLoad={(event) => {
            const src = event.source;
            if (src?.width && src?.height) {
              setMediaSourceSize({ width: src.width, height: src.height });
            }
            setMediaDecoded(true);
            setMediaError(false);
          }}
          onError={() => {
            setMediaError(true);
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={[styles.face, { borderRadius: radius }, CARD_SHADOW]}>
        <View style={styles.flipRoot}>
          <Animated.View
            style={[styles.faceSide, styles.faceFront, frontFaceStyle]}
            pointerEvents={flipped ? 'none' : 'auto'}
            accessibilityElementsHidden={frontA11yHidden}
            importantForAccessibility={frontA11yHidden ? 'no-hide-descendants' : 'auto'}
            {...(Platform.OS === 'web' ? { 'aria-hidden': frontA11yHidden } : null)}
          >
            {front}
          </Animated.View>
          <Animated.View
            style={[styles.faceSide, styles.faceBack, backFaceStyle]}
            pointerEvents={flipped ? 'auto' : 'none'}
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
  eagerPreload: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 0,
    right: 0,
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
    ...StyleSheet.absoluteFillObject,
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
  /** Room below short titles; long titles grow into this then the face scrolls. */
  frontTitleBottomSpacer: {
    flexGrow: 1,
    minHeight: 48,
    width: '100%',
  },
  conceptNameFront: {
    width: '100%',
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
