import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONCEPT_COMPLEXITY } from '@/lib/api';

const STORAGE_KEY = 'lateralzr.conceptComplexity';

export const MIN_CONCEPT_COMPLEXITY = 1;
export const MAX_CONCEPT_COMPLEXITY = 5;

export function clampComplexity(value: number): number {
  return Math.min(MAX_CONCEPT_COMPLEXITY, Math.max(MIN_CONCEPT_COMPLEXITY, Math.round(value)));
}

export async function loadStoredComplexity(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') return DEFAULT_CONCEPT_COMPLEXITY;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_CONCEPT_COMPLEXITY;
    return clampComplexity(n);
  } catch {
    return DEFAULT_CONCEPT_COMPLEXITY;
  }
}

export async function persistComplexity(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(clampComplexity(value)));
  } catch {
    // ignore persistence failures
  }
}
