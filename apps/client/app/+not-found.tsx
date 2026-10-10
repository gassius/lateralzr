import { Link, Stack } from 'expo-router';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

export default function NotFoundScreen() {
  const fontScale = PixelRatio.getFontScale();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={[styles.title, textStyle('sheetTitle', { fontScale })]}>
          This screen doesn't exist.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, textStyle('label', { fontScale })]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: color.shell,
  },
  title: {
    color: color.paper,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    color: color.front,
  },
});
