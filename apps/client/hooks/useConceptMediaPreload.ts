import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ConceptItem } from '@/lib/api';
import { REMOTE_IMAGE_HEADERS } from '@/lib/remoteImage';

const BATCH_DEBOUNCE_MS = 200;

const prefetchOpts = {
  cachePolicy: 'memory-disk' as const,
  headers: REMOTE_IMAGE_HEADERS,
};

function uniqueMediaUrls(concepts: ConceptItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of concepts) {
    const u = c.mediaUrl?.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

async function prefetchOne(url: string): Promise<boolean> {
  try {
    return await Image.prefetch(url, prefetchOpts);
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
 * Prefetches concept images: immediate load for the visible card, debounced batch for the rest.
 * Tracks URLs that prefetched successfully for UI (e.g. shorter image transition).
 */
export function useConceptMediaPreload(concepts: ConceptItem[], currentIndex: number) {
  const [preloadedMediaUrls, setPreloadedMediaUrls] = useState<ReadonlySet<string>>(() => new Set());

  /** Current card first — helps first flip after load or after swipe before batch finishes. */
  useEffect(() => {
    const url = concepts[currentIndex]?.mediaUrl?.trim();
    if (!url) return;

    let cancelled = false;
    void (async () => {
      const ok = await prefetchOne(url);
      if (cancelled || !ok) return;
      setPreloadedMediaUrls((prev) => mergeReady(prev, [url]));
    })();

    return () => {
      cancelled = true;
    };
  }, [concepts, currentIndex]);

  /** Remaining URLs after payload settles (debounced so rapid refetches don’t thrash). */
  useEffect(() => {
    const urls = uniqueMediaUrls(concepts);
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
  }, [concepts]);

  return { preloadedMediaUrls };
}
