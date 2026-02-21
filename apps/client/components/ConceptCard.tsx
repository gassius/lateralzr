import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/Themed';
import type { ConceptItem } from '@/lib/api';
import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

type ConceptCardProps = {
  item: ConceptItem;
};

export function ConceptCard({ item }: ConceptCardProps) {
  const [flipped, setFlipped] = useState(false);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const flip = () => setFlipped((prev) => !prev);

  const front = (
    <View style={[styles.faceInner, { backgroundColor: colors.background }]}>
      {item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      <Text style={styles.conceptName}>{item.concept}</Text>
      <Text style={styles.hint}>Tap to flip</Text>
    </View>
  );

  const back = (
    <View style={[styles.faceInner, { backgroundColor: colors.background }]}>
      <Text style={styles.conceptName}>{item.concept}</Text>
      <Text style={styles.description}>{item.shortDescription || 'No description.'}</Text>
      {item.wikiUrl ? (
        <Text style={styles.link} onPress={() => Linking.openURL(item.wikiUrl!)}>
          Wikipedia
        </Text>
      ) : null}
      <Text style={styles.hint}>Tap to flip back</Text>
    </View>
  );

  return (
    <Pressable onPress={flip} style={styles.card}>
      <View style={[styles.face]}>
        {flipped ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
            {back}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
            {front}
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
  },
  face: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  faceInner: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 12,
  },
  conceptName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    opacity: 0.9,
  },
  link: {
    fontSize: 16,
    color: '#2f95dc',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 'auto',
  },
});
