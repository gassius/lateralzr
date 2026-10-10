import { color } from './tokens';

/**
 * Wordmark gradient stops (pending restyle in Lz-30).
 * Non-token hexes stay here so UI modules stay free of stray palette literals.
 */
export const lateralityGradientExtras = {
  coolMid: '#9bb8c2',
  coolBlend: '#c5d4d8',
  warmBlend: '#d4c4a8',
  orangeSoft: '#f3a24a',
  orangeLight: '#f7c27a',
  /** Pre-v3.3 cool gray used at low laterality; not in §23 color. */
  coolGray: '#cdced0',
} as const;

export const lateralityGradientPaper = color.paper;
export const lateralityGradientFront = color.front;
