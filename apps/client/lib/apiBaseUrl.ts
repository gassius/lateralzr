import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOCAL_PLACEHOLDERS = new Set(['http://localhost', 'http://127.0.0.1']);

/**
 * Resolves the API base URL for Expo Go / simulators / web.
 *
 * On a physical device, `http://localhost` points at the phone, not your computer.
 * When EXPO_PUBLIC_API_URL is unset or a localhost placeholder, we derive the host
 * from `expo-constants` (same host Metro uses), which matches Expo's local-dev guidance.
 *
 * @see https://docs.expo.dev/guides/environment-variables/
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (Platform.OS === 'web') {
    return fromEnv ?? 'http://localhost';
  }

  if (fromEnv && !LOCAL_PLACEHOLDERS.has(fromEnv)) {
    return fromEnv;
  }

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && !LOCAL_PLACEHOLDERS.has(`http://${host}`)) {
        return `http://${host}`;
      }
      if (
        Platform.OS === 'android' &&
        host &&
        (host === 'localhost' || host === '127.0.0.1')
      ) {
        return 'http://10.0.2.2';
      }
    }
  }

  return fromEnv ?? 'http://localhost';
}
