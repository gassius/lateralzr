/** Auto-derived motif placements from production pattern SVGs (Lz-25). */
export type PatternMotifPlacement = {
  id: string;
  cx: number;
  cy: number;
  rotate: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
};

export type PatternTitleClearRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PatternVariantPlacement = {
  motifs: readonly PatternMotifPlacement[];
  titleClear: PatternTitleClearRect;
};

export const PATTERN_VARIANT_PLACEMENTS: readonly PatternVariantPlacement[] = [
  {
    titleClear: {
      x: 20.0,
      y: 236.0,
      width: 318.0,
      height: 168.0,
    },
    motifs: [
      { id: 'm01', cx: 40.0, cy: 40.0, rotate: -12.0, sx: 0.3163, sy: 0.3163, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 118.0, cy: 62.0, rotate: 8.0, sx: -0.3571, sy: 0.3571, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 62.0, cy: 128.0, rotate: -20.0, sx: -0.3265, sy: 0.3265, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 172.0, cy: 126.0, rotate: 14.0, sx: 0.3367, sy: 0.3367, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 244.0, cy: 170.0, rotate: -6.0, sx: 0.3469, sy: 0.3469, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 318.0, cy: 148.0, rotate: 22.0, sx: -0.2959, sy: 0.2959, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 296.0, cy: 196.0, rotate: -28.0, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 204.0, cy: 190.0, rotate: 30.0, sx: -0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 250.0, cy: 92.0, rotate: -10.0, sx: -0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm10', cx: 124.0, cy: 194.0, rotate: 18.0, sx: 0.2245, sy: 0.2245, ox: -143.0, oy: -97.0 },
      { id: 'm11', cx: 44.0, cy: 470.0, rotate: 10.0, sx: 0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm12', cx: 112.0, cy: 512.0, rotate: -18.0, sx: -0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
    ],
  },
  {
    titleClear: {
      x: 20.0,
      y: 236.0,
      width: 318.0,
      height: 168.0,
    },
    motifs: [
      { id: 'm01', cx: 312.0, cy: 42.0, rotate: 10.0, sx: -0.2959, sy: 0.2959, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 250.0, cy: 92.0, rotate: -14.0, sx: 0.3163, sy: 0.3163, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 176.0, cy: 140.0, rotate: 18.0, sx: -0.3265, sy: 0.3265, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 104.0, cy: 180.0, rotate: -8.0, sx: 0.3163, sy: 0.3163, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 40.0, cy: 196.0, rotate: 24.0, sx: -0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 330.0, cy: 108.0, rotate: -30.0, sx: 0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 300.0, cy: 442.0, rotate: -12.0, sx: 0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 236.0, cy: 478.0, rotate: 16.0, sx: -0.3061, sy: 0.3061, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 318.0, cy: 520.0, rotate: -24.0, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm10', cx: 170.0, cy: 526.0, rotate: 8.0, sx: -0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
    ],
  },
  {
    titleClear: {
      x: 20.0,
      y: 236.0,
      width: 270.0,
      height: 168.0,
    },
    motifs: [
      { id: 'm01', cx: 40.0, cy: 34.0, rotate: -10.0, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 168.0, cy: 48.0, rotate: 14.0, sx: -0.2755, sy: 0.2755, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 258.0, cy: 74.0, rotate: -8.0, sx: 0.2959, sy: 0.2959, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 320.0, cy: 132.0, rotate: 20.0, sx: -0.3061, sy: 0.3061, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 300.0, cy: 196.0, rotate: -16.0, sx: 0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 330.0, cy: 268.0, rotate: 14.0, sx: -0.2245, sy: 0.2245, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 320.0, cy: 342.0, rotate: -12.0, sx: 0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 334.0, cy: 436.0, rotate: 10.0, sx: -0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 286.0, cy: 474.0, rotate: -22.0, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm10', cx: 230.0, cy: 522.0, rotate: 12.0, sx: -0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm11', cx: 292.0, cy: 520.0, rotate: -6.0, sx: 0.3061, sy: 0.3061, ox: -143.0, oy: -97.0 },
    ],
  },
] as const;
