import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { ConceptItem } from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  nearbyCardMediaUrls,
  uniqueCardMediaUrls,
} from '@/lib/conceptMediaPrefetch';
import { remoteImageHeadersForPlatform } from '@/lib/remoteImage';

const BATCH_DEBOUNCE_MS = 200;

function prefetchOpts() {
  const headers = remoteImageHeadersForPlatform(Platform.OS);
  return {
    cachePolicy: 'memory-disk' as const,
    ...(headers ? { headers } : {}),
  };
}

async function prefetchOne(url: string): Promise<boolean> {
  try {
    return await Image.prefetch(url, prefetchOpts());
  } catch {
    return false;
  }
}

function mergeReady(prev: ReadonlySet<string>, urls: string[]): ReadonlySet<string> {
  if (urls.length === 0) return prev;
  const next = new Set(prev);
  urls.forEach((u) => next.add(u));
  return next;
}

/**
 * Prefetches concept images at display request width: immediate for the
 * current + next 1–2 cards, debounced batch for the rest of the deck.
 * Tracks URLs that prefetched successfully for UI (e.g. shorter image transition).
 * `requestWidth` must be the same value ConceptCard uses (from cardLayout.width).
 */
export function useConceptMediaPreload(
  concepts: ConceptItem[],
  currentIndex: number,
  requestWidth: number,
) {
  const [preloadedMediaUrls, setPreloadedMediaUrls] = useState<ReadonlySet<string>>(() => new Set());

  /** Current + next 1–2 — ahead of swipe/flip before the deck-wide batch finishes. */
  useEffect(() => {
    if (!(requestWidth > 0)) return;
    const urls = nearbyCardMediaUrls(concepts, currentIndex, requestWidth, {
      platform: Platform.OS,
      apiBaseUrl: resolveApiBaseUrl(),
    });
    if (urls.length === 0) return;

    let cancelled = false;
    void (async () => {
      const results = await Promise.all(urls.map((u) => prefetchOne(u)));
      if (cancelled) return;
      const ok = urls.filter((u, i) => results[i]);
      if (ok.length === 0) return;
      setPreloadedMediaUrls((prev) => mergeReady(prev, ok));
    })();

    return () => {
      cancelled = true;
    };
  }, [concepts, currentIndex, requestWidth]);

  /** Remaining URLs after payload settles (debounced so rapid refetches don’t thrash). */
  useEffect(() => {
    if (!(requestWidth > 0)) return;
    const urls = uniqueCardMediaUrls(concepts, requestWidth, {
      platform: Platform.OS,
      apiBaseUrl: resolveApiBaseUrl(),
    });
    if (urls.length === 0) return;

    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        const results = await Promise.all(urls.map((u) => prefetchOne(u)));
        if (cancelled) return;
        const ok = urls.filter((u, i) => results[i]);
        if (ok.length === 0) return;
        setPreloadedMediaUrls((prev) => mergeReady(prev, ok));
      })();
    }, BATCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [concepts, requestWidth]);

  return { preloadedMediaUrls };
}
