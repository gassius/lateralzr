import { useEffect, useLayoutEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { ConceptItem } from '@/lib/api';
import { Palette } from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  CARD_BACK_FACE_PADDING,
  cardBackBalancedColumnStyle,
  cardBackScrollMinHeight,
  composeCardBackLayout,
  resolveCardBackMediaPhase,
} from '@/lib/cardBackLayout';
import {
  conceptFrontLabelTextAlign,
  conceptFrontLabelTextAlignFromLineCount,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
} from '@/lib/conceptFrontLabelAlign';
import { CoachHint } from './CoachHint';
import { FLIP_COACH_PEEK_AMOUNT } from '@/lib/discoveryCoaching';
import { t } from '@/lib/i18n';
import { remoteImageSource } from '@/lib/remoteImage';

const FLIP_MS = 420;

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
};

export function ConceptCard({
  item,
  flipped,
  isMediaPrefetched,
  coachHint,
  animateCoachAppear = true,
  flipPeek,
}: ConceptCardProps) {
  const title = capitalizeFirstLetter(item.concept);
  const imageSource = remoteImageSource(item.mediaUrl, Platform.OS, resolveApiBaseUrl());
  const mediaUri = imageSource?.uri ?? '';

  const [mediaDecoded, setMediaDecoded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [backFaceH, setBackFaceH] = useState(0);
  const [frontContentWidth, setFrontContentWidth] = useState(0);
  const [frontLineCount, setFrontLineCount] = useState<number | null>(null);
  const estimatedFrontAlign = conceptFrontLabelTextAlign(title, frontContentWidth);
  const frontLabelAlign =
    frontLineCount == null
      ? estimatedFrontAlign
      : conceptFrontLabelTextAlignFromLineCount(frontLineCount);
  /** 0 = front, 1 = back — opacity + rotate crossfade (reliable vs single rotateY + overflow on RN). */
  const flipProgress = useSharedValue(0);
  const fallbackFlipPeek = useSharedValue(0);
  const flipPeekSV = flipPeek ?? fallbackFlipPeek;

  useEffect(() => {
    flipProgress.value = withTiming(flipped ? 1 : 0, {
      duration: FLIP_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, flipProgress]);

  useLayoutEffect(() => {
    setFrontLineCount(null);
  }, [title]);

  // Before paint: avoids one post-paint frame where the old decoded flag pairs with a new URI.
  // Prefetched URLs are treated as ready so deck handoff (same card promoted from behind → front) never briefly resets.
  useLayoutEffect(() => {
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
    nativeEvent: { layout: { height: number } };
  }) => {
    const next = event.nativeEvent.layout.height;
    setBackFaceH((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  };

  const front = (
    <View style={styles.faceInner} onLayout={onUntransformedFaceLayout}>
      <View
        style={styles.frontCenter}
        onLayout={(event) => setFrontContentWidth(event.nativeEvent.layout.width)}
      >
        <Text
          style={[styles.conceptNameFront, { textAlign: frontLabelAlign }]}
          onTextLayout={(event) => {
            setFrontLineCount(event.nativeEvent.lines.length);
          }}
        >
          {title}
        </Text>
      </View>
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
  const backLayout = composeCardBackLayout(mediaPhase);
  const { rhythm } = backLayout;
  const backScrollMinHeight = cardBackScrollMinHeight(backFaceH);
  const noMediaColumnStyle = cardBackBalancedColumnStyle(backFaceH);

  const backTitle = (
    <Text
      style={[
        styles.conceptName,
        {
          fontSize: rhythm.titleFontSize,
          lineHeight: rhythm.titleLineHeight,
          marginBottom: rhythm.titleMarginBottom,
        },
      ]}
      testID="card-back-title"
    >
      {title}
    </Text>
  );

  const backDescription = (
    <Text
      style={[
        styles.description,
        {
          fontSize: rhythm.descriptionFontSize,
          lineHeight: rhythm.descriptionLineHeight,
          marginBottom: rhythm.descriptionMarginBottom,
        },
      ]}
    >
      {item.shortDescription || t('noDescription')}
    </Text>
  );

  const backWiki = item.wikiUrl ? (
    <Text
      style={[styles.link, { marginTop: rhythm.linkMarginTop }]}
      onPress={() => Linking.openURL(item.wikiUrl!)}
    >
      {t('wikipedia')}
    </Text>
  ) : null;

  const backCopy = (
    <View style={styles.copyCluster} testID="card-back-copy">
      {backDescription}
      {backWiki}
    </View>
  );

  const backMedia =
    backLayout.showMediaZone && imageSource ? (
      <View
        style={[styles.mediaSlot, backLayout.expandMediaZone && styles.mediaSlotExpand]}
        testID="card-back-media"
      >
        {backLayout.showMediaImage ? (
          <Image
            source={imageSource}
            style={[
              StyleSheet.absoluteFillObject,
              styles.mediaImageInner,
              backLayout.showMediaPlaceholder ? styles.mediaImagePending : null,
            ]}
            contentFit="contain"
            contentPosition="center"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            onLoad={() => {
              setMediaDecoded(true);
              setMediaError(false);
            }}
            onLoadEnd={() => {
              setMediaDecoded(true);
            }}
            onError={() => {
              setMediaError(true);
            }}
            accessibilityRole="image"
            accessibilityLabel={t('illustrationFor', { concept: item.concept })}
          />
        ) : null}
        {backLayout.showMediaPlaceholder ? (
          <View
            style={styles.mediaPlaceholder}
            pointerEvents="none"
            testID="card-back-media-placeholder"
          />
        ) : null}
      </View>
    ) : null;

  /**
   * No-media: measured pixel height on an absolutely positioned column, then
   * center title + description + Wikipedia as one group. flex leftover and
   * bottom:0 do not stretch under the flip transform on RN Web, which is why
   * #36 stayed top-heavy. With-media: unchanged expanding well.
   */
  const back = (
    <View style={styles.faceInner}>
      {backLayout.balanceCopy ? (
        <View
          style={[styles.backInnerBalanced, noMediaColumnStyle]}
          testID={`card-back-${backLayout.mode}`}
        >
          <View style={styles.noMediaCopyGroup} testID="card-back-copy">
            {backTitle}
            {backDescription}
            {backWiki}
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.backScroll}
          contentContainerStyle={[
            styles.backScrollContent,
            backScrollMinHeight != null ? { minHeight: backScrollMinHeight } : null,
          ]}
          showsVerticalScrollIndicator={false}
          bounces
          testID={`card-back-${backLayout.mode}`}
        >
          <View style={styles.backInnerWithMedia}>
            {backTitle}
            {backMedia}
            {backCopy}
          </View>
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={styles.card}>
      {mediaUri.length > 0 && imageSource ? (
        <Image
          source={imageSource}
          style={styles.eagerPreload}
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
          onError={() => {
            setMediaError(true);
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={styles.face}>
        <View style={styles.flipRoot}>
          <Animated.View style={[styles.faceSide, styles.faceFront, frontFaceStyle]} pointerEvents={flipped ? 'none' : 'auto'}>
            {front}
          </Animated.View>
          <Animated.View style={[styles.faceSide, styles.faceBack, backFaceStyle]} pointerEvents={flipped ? 'auto' : 'none'}>
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
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
    padding: CARD_BACK_FACE_PADDING,
    borderRadius: 16,
    backgroundColor: Palette.orange,
    borderWidth: 1,
    borderColor: 'rgba(19,91,119,0.35)',
    minHeight: 0,
    position: 'relative',
  },
  backScroll: {
    flex: 1,
    minHeight: 0,
  },
  backScrollContent: {
    flexGrow: 1,
  },
  backInnerWithMedia: {
    flexGrow: 1,
    width: '100%',
  },
  /**
   * Pin to the face box with a measured pixel height. flex leftover and
   * `bottom: 0` do not stretch this column under the flip transform on RN Web.
   */
  backInnerBalanced: {
    position: 'absolute',
    top: CARD_BACK_FACE_PADDING,
    left: CARD_BACK_FACE_PADDING,
    right: CARD_BACK_FACE_PADDING,
  },
  noMediaCopyGroup: {
    width: '100%',
  },
  mediaSlot: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(19,91,119,0.10)',
  },
  mediaSlotExpand: {
    flexGrow: 1,
    minHeight: 180,
  },
  mediaImageInner: {
    borderRadius: 12,
  },
  mediaImagePending: {
    opacity: 0,
  },
  mediaPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19,91,119,0.10)',
  },
  copyCluster: {
    width: '100%',
  },
  frontCenter: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    minHeight: 0,
  },
  conceptNameFront: {
    fontSize: CONCEPT_FRONT_LABEL_FONT_SIZE,
    lineHeight: Math.round(CONCEPT_FRONT_LABEL_FONT_SIZE * 1.5),
    fontWeight: '700',
    width: '100%',
    color: Palette.darkBlue,
  },
  conceptName: {
    fontWeight: '700',
    color: Palette.darkBlue,
  },
  description: {
    opacity: 0.92,
    color: Palette.darkBlue,
  },
  link: {
    fontSize: 16,
    color: Palette.darkBlue,
    marginBottom: 8,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
