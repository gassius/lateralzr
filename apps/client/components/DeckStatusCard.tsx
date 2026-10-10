import { PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';
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
  const fontScale = PixelRatio.getFontScale();
  const captionType = textStyle('body', { fontScale });
  const retryType = textStyle('row', { fontScale });

  return (
    <View style={styles.root}>
      <View style={styles.faceInner}>
        <View style={styles.center}>
        <LateralzrLogo animate={animate} />
        {variant === 'loading' ? (
          <Text style={[styles.caption, captionType]}>
            {t('loadingMoreIdeas')}
          </Text>
        ) : null}
        {variant === 'error' ? (
          <>
            <Text style={[styles.caption, captionType]}>
              {t('couldNotLoadMore')}
            </Text>
            {onRetry ? (
              <Pressable onPress={onRetry} style={styles.retry}>
                <Text style={[styles.retryText, retryType]}>
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
    padding: 20,
    borderRadius: 16,
    backgroundColor: color.front,
    borderWidth: 1,
    borderColor: 'rgba(19,91,119,0.35)',
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
