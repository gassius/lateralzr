import { layout } from '../theme/tokens';
import type { ConceptMedia } from './api';

/**
 * Symmetric vertical hitSlop so a text-sized licence control meets §18.
 * Pass the rendered font size (meta token × font/e2e scale).
 */
export function cardBackLicenceHitSlop(fontSize: number): number {
  const size = Number.isFinite(fontSize) ? Math.max(0, fontSize) : 0;
  return Math.max(0, Math.ceil((layout.recommendedTouchTarget - size) / 2));
}

export type CardBackChangeNoticeKey = 'cropped' | 'resized';

export type CardBackCreditModel = {
  creator: string | null;
  licenceName: string | null;
  licenceUrl: string | null;
  changeNoticeKey: CardBackChangeNoticeKey | null;
  changeNoticeRaw: string | null;
};

function usableHttpUrl(url?: string | null): string | null {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return trimmed;
  } catch {
    return null;
  }
}

function noticeKey(value?: string | null): CardBackChangeNoticeKey | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === 'cropped' || normalized === 'crop') return 'cropped';
  if (normalized === 'resized' || normalized === 'resize') return 'resized';
  return null;
}

function hostFallback(mediaUrl?: string | null, wikimediaLabel?: string): string | null {
  if (!mediaUrl) return null;
  try {
    const host = new URL(mediaUrl).hostname;
    if (host === 'upload.wikimedia.org') return wikimediaLabel ?? 'Wikimedia Commons';
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Credit the displayed asset only. Missing provenance is tolerated: no licence
 * link, optional host fallback when a licence name exists without a creator.
 */
export function resolveCardBackCredit(
  media: ConceptMedia | undefined,
  mediaUrl?: string | null,
  wikimediaLabel?: string,
): CardBackCreditModel {
  if (!media) {
    return {
      creator: null,
      licenceName: null,
      licenceUrl: null,
      changeNoticeKey: null,
      changeNoticeRaw: null,
    };
  }

  const licenceName = (media.licenceName ?? media.license)?.trim() || null;
  const creator = media.creator?.trim() || null;
  const rawNotice = media.changeNotice?.trim() || null;
  const key = noticeKey(rawNotice);

  return {
    creator: creator ?? (licenceName ? hostFallback(mediaUrl ?? media.url, wikimediaLabel) : null),
    licenceName,
    licenceUrl: usableHttpUrl(media.licenceUrl),
    changeNoticeKey: key,
    changeNoticeRaw: key || !rawNotice ? null : rawNotice,
  };
}

export function cardBackCreditHasRow(credit: CardBackCreditModel): boolean {
  return Boolean(credit.creator || credit.licenceName || credit.changeNoticeKey || credit.changeNoticeRaw);
}
