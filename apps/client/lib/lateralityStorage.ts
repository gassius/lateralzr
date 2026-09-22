import AsyncStorage from '@react-native-async-storage/async-storage';
import { clampLaterality, DEFAULT_LATERALITY, type LateralityGrade } from './laterality';

const STORAGE_KEY = 'lateralzr.conceptLaterality';

export async function loadStoredLaterality(): Promise<LateralityGrade> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw.trim() === '') return DEFAULT_LATERALITY;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_LATERALITY;
    return clampLaterality(n);
  } catch {
    return DEFAULT_LATERALITY;
  }
}

export async function persistLaterality(value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(clampLaterality(value)));
  } catch {
    // ignore persistence failures
  }
}
