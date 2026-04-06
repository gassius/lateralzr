import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/Themed';
import type { ConceptItem } from '@/lib/api';
import { Palette } from '@/constants/Colors';
import { REMOTE_IMAGE_HEADERS } from '@/lib/remoteImage';

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
  const mediaUri = item.mediaUrl?.trim() ?? '';

  const [mediaDecoded, setMediaDecoded] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaDecoded(false);
    setMediaError(false);
  }, [mediaUri]);

  const imageSource = mediaUri ? { uri: mediaUri, headers: REMOTE_IMAGE_HEADERS } : null;

  const front = (
    <View style={styles.faceInner}>
      <View style={styles.frontCenter}>
        <Text
          style={styles.conceptNameFront}
          lightColor={Palette.darkBlue}
          darkColor={Palette.darkBlue}
        >
          {title}
        </Text>
      </View>
      <Text style={styles.hint} lightColor={Palette.darkBlue} darkColor={Palette.darkBlue}>
        Tap to flip
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
      <Text style={styles.conceptName} lightColor={Palette.darkBlue} darkColor={Palette.darkBlue}>
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
            transition={isMediaPrefetched ? 0 : 280}
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
            accessibilityLabel={`Illustration for ${item.concept}`}
          />
          {showLoadingOverlay ? (
            <View style={styles.mediaLoadingOverlay} pointerEvents="none">
              <ActivityIndicator color={Palette.darkBlue} />
            </View>
          ) : null}
          {mediaError ? (
            <View style={styles.mediaErrorOverlay} pointerEvents="none">
              <Text style={styles.mediaErrorText} lightColor={Palette.darkBlue} darkColor={Palette.darkBlue}>
                Image unavailable
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.description} lightColor={Palette.darkBlue} darkColor={Palette.darkBlue}>
        {item.shortDescription || 'No description.'}
      </Text>
      {item.wikiUrl ? (
        <Text
          style={styles.link}
          lightColor={Palette.darkBlue}
          darkColor={Palette.darkBlue}
          onPress={() => Linking.openURL(item.wikiUrl!)}
        >
          Wikipedia
        </Text>
      ) : null}
      <Text style={styles.hint} lightColor={Palette.darkBlue} darkColor={Palette.darkBlue}>
        Tap to flip back
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
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={styles.face}>
        {flipped ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.faceFill}>
            {back}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.faceFill}>
            {front}
          </Animated.View>
        )}
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
  faceFill: {
    flex: 1,
    minHeight: 0,
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
  },
  frontCenter: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    minHeight: 0,
  },
  conceptNameFront: {
    fontSize: 48,
    lineHeight: 72,
    fontWeight: '700',
    textAlign: 'left',
    width: '100%',
    wordWrap: 'normal',
  },
  conceptName: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    opacity: 0.92,
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
  },
});
