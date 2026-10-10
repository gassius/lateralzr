import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';
import { cardPadding, cardRadius } from '@/lib/cardLayout';
import { t } from '@/lib/i18n';

type DeckStatusCardProps = {
  variant: 'loading' | 'error';
  onRetry?: () => void;
};

/**
 * Full-height card shell matching ConceptCard — logo + short message for load-more / error.
 */
export function DeckStatusCard({ variant, onRetry }: DeckStatusCardProps) {
  const animate = variant === 'loading';
  const { width: windowWidth } = useWindowDimensions();
  const facePad = cardPadding(windowWidth);
  const radius = cardRadius();

  return (
    <View style={styles.root}>
      <View style={[styles.faceInner, { padding: facePad, borderRadius: radius }]}>
        <View style={styles.center}>
        <LateralzrLogo animate={animate} />
        {variant === 'loading' ? (
          <Text style={[styles.caption, textStyle('body')]}>
            {t('loadingMoreIdeas')}
          </Text>
        ) : null}
        {variant === 'error' ? (
          <>
            <Text style={[styles.caption, textStyle('body')]}>
              {t('couldNotLoadMore')}
            </Text>
            {onRetry ? (
              <Pressable onPress={onRetry} style={styles.retry}>
                <Text style={[styles.retryText, textStyle('row')]}>
                  {t('tapToRetry')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  faceInner: {
    flex: 1,
    backgroundColor: color.front,
    minHeight: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    minHeight: 280,
  },
  caption: {
    textAlign: 'center',
    paddingHorizontal: 12,
    opacity: 0.92,
    color: color.concept,
  },
  retry: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: {
    textDecorationLine: 'underline',
    color: color.concept,
  },
});
