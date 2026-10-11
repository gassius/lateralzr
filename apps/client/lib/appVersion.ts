import Constants from 'expo-constants';

/** App version from Expo config / app.json (About view). */
export function readAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}
