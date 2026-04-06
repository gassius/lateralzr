/** Headers for Wikimedia / CDN image requests (native loaders may omit defaults web sends). */
export const REMOTE_IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': 'Lateralzr/1.0 (https://github.com/lateralzr; educational)',
  Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8',
};
