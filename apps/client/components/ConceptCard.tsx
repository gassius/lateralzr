import { useEffect, useLayoutEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ConceptItem } from '@/lib/api';
import { Palette } from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  conceptFrontLabelTextAlign,
  conceptFrontLabelTextAlignFromLineCount,
  CONCEPT_FRONT_LABEL_FONT_SIZE,
} from '@/lib/conceptFrontLabelAlign';
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
};

export function ConceptCard({ item, flipped, isMediaPrefetched }: ConceptCardProps) {
  const title = capitalizeFirstLetter(item.concept);
  const imageSource = remoteImageSource(item.mediaUrl, Platform.OS, resolveApiBaseUrl());
  const mediaUri = imageSource?.uri ?? '';

  const [mediaDecoded, setMediaDecoded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [frontContentWidth, setFrontContentWidth] = useState(0);
  const [frontLineCount, setFrontLineCount] = useState<number | null>(null);
  const estimatedFrontAlign = conceptFrontLabelTextAlign(title, frontContentWidth);
  const frontLabelAlign =
    frontLineCount == null
      ? estimatedFrontAlign
      : conceptFrontLabelTextAlignFromLineCount(frontLineCount);
  /** 0 = front, 1 = back — opacity + rotate crossfade (reliable vs single rotateY + overflow on RN). */
  const flipProgress = useSharedValue(0);

  useEffect(() => {
    flipProgress.value = withTiming(flipped ? 1 : 0, {
      duration: FLIP_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, flipProgress]);

  useLayoutEffect(() => {
    setFrontLineCount(null);
  }, [title]);

  // Before paint: avoids one post-paint frame where the old decoded flag pairs with a new URI (spinner / flash).
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
    const rot = interpolate(flipProgress.value, [0, 1], [0, -90]);
    return {
      opacity: interpolate(flipProgress.value, [0, 0.48, 0.52, 1], [1, 1, 0, 0]),
      transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
    };
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const rot = interpolate(flipProgress.value, [0, 1], [90, 0]);
    return {
      opacity: interpolate(flipProgress.value, [0, 0.48, 0.52, 1], [0, 0, 1, 1]),
      transform: [{ perspective: 1200 }, { rotateY: `${rot}deg` }],
    };
  });

  const front = (
    <View style={styles.faceInner}>
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
      <Text style={styles.hint}>
        {t('tapToFlip')}
      </Text>
    </View>
  );

  const showLoadingOverlay = mediaUri.length > 0 && !mediaDecoded && !mediaError;

  const back = (
    <ScrollView
      style={[styles.faceInner, styles.backScroll]}
      contentContainerStyle={styles.backScrollContent}
      showsVerticalScrollIndicator={false}
      bounces
    >
      <Text style={styles.conceptName}>
        {title}
      </Text>
      {mediaUri.length > 0 && imageSource ? (
        <View style={styles.mediaSlot}>
          <Image
            source={imageSource}
            style={[StyleSheet.absoluteFillObject, styles.mediaImageInner]}
            contentFit="contain"
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
          {showLoadingOverlay ? (
            <View style={styles.mediaLoadingOverlay} pointerEvents="none">
              <ActivityIndicator color={Palette.darkBlue} />
            </View>
          ) : null}
          {mediaError ? (
            <View style={styles.mediaErrorOverlay} pointerEvents="none">
              <Text style={styles.mediaErrorText}>
                {t('imageUnavailable')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.description}>
        {item.shortDescription || t('noDescription')}
      </Text>
      {item.wikiUrl ? (
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(item.wikiUrl!)}
        >
          {t('wikipedia')}
        </Text>
      ) : null}
      <Text style={styles.hint}>
        {t('tapToFlipBack')}
      </Text>
    </ScrollView>
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
    padding: 20,
    borderRadius: 16,
    backgroundColor: Palette.orange,
    borderWidth: 1,
    borderColor: 'rgba(19,91,119,0.35)',
    minHeight: 0,
  },
  backScroll: {
    flex: 1,
  },
  backScrollContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  mediaSlot: {
    width: '100%',
    height: 200,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(19,91,119,0.06)',
  },
  mediaImageInner: {
    borderRadius: 12,
  },
  mediaLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  mediaErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 8,
  },
  mediaErrorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.85,
    color: Palette.darkBlue,
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
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
    color: Palette.darkBlue,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
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
  hint: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 'auto',
    color: Palette.darkBlue,
  },
});
