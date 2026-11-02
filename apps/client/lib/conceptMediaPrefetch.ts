import type { ConceptItem } from '@/lib/api';
import { resolveCardMediaUrl } from '@/lib/remoteImage';

/** Immediate prefetch window: current + next 1–2 cards (swipe/flip ahead). */
export const MEDIA_PREFETCH_AHEAD = 2;

/** Display-sized media URLs for `currentIndex` … `currentIndex + ahead` (inclusive). */
export function nearbyCardMediaUrls(
  concepts: ConceptItem[],
  currentIndex: number,
  requestWidth: number,
  options: {
    platform: string;
    apiBaseUrl: string;
    ahead?: number;
  },
): string[] {
  const ahead = options.ahead ?? MEDIA_PREFETCH_AHEAD;
  const seen = new Set<string>();
  const out: string[] = [];
  const last = Math.min(concepts.length - 1, currentIndex + Math.max(0, ahead));
  for (let i = Math.max(0, currentIndex); i <= last; i += 1) {
    const u = resolveCardMediaUrl({
      mediaUrl: concepts[i]?.mediaUrl,
      platform: options.platform,
      apiBaseUrl: options.apiBaseUrl,
      requestWidth,
    });
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Unique display-sized media URLs for an entire concept list. */
export function uniqueCardMediaUrls(
  concepts: ConceptItem[],
  requestWidth: number,
  options: {
    platform: string;
    apiBaseUrl: string;
  },
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of concepts) {
    const u = resolveCardMediaUrl({
      mediaUrl: c.mediaUrl,
      platform: options.platform,
      apiBaseUrl: options.apiBaseUrl,
      requestWidth,
    });
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
