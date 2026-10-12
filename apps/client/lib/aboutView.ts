import type { MessageKey } from './i18n';

type Translate = (key: MessageKey) => string;

export type AboutViewContent = {
  logoLabel: string;
  logoOpacity: number;
  promise: string;
  version: string;
};

/** Copy + lockup the About view renders. Tests mutate these independently. */
export function aboutViewContent(translate: Translate, version: string): AboutViewContent {
  return {
    logoLabel: 'Lateralzr',
    logoOpacity: 1,
    promise: translate('aboutPromise'),
    version,
  };
}
