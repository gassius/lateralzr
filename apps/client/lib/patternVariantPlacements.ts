/** Auto-derived motif placements from production pattern SVGs (Lz-58 / v3.4). */
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
  /** Inter-bulb connectors (glow targets). */
  connectors: readonly { id: string; from: string; to: string }[];
};

export const PATTERN_VARIANT_PLACEMENTS: readonly PatternVariantPlacement[] = [
  {
    titleClear: {
      x: 20.0,
      y: 250.0,
      width: 318.0,
      height: 160.0,
    },
    motifs: [
      { id: 'm01', cx: 40.0, cy: 52.0, rotate: -8.0, sx: 0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 111.1, cy: 47.6, rotate: 0.8, sx: -0.3163, sy: 0.3163, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 174.4, cy: 91.4, rotate: -5.2, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 113.3, cy: 141.0, rotate: 0.8, sx: -0.3061, sy: 0.3061, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 236.9, cy: 90.5, rotate: 3.6, sx: -0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 171.6, cy: 181.3, rotate: -5.2, sx: 0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 295.4, cy: 135.3, rotate: -2.4, sx: 0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 205.9, cy: 33.7, rotate: 27.5, sx: -0.2245, sy: 0.2245, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 233.6, cy: 180.5, rotate: 3.6, sx: -0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm10', cx: 286.3, cy: 220.9, rotate: -2.4, sx: 0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm11', cx: 48.0, cy: 492.0, rotate: 6.0, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm12', cx: 110.7, cy: 503.5, rotate: 14.8, sx: -0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
    ],
    connectors: [
      { id: 'c01', from: 'm01', to: 'm02' },
      { id: 'c02', from: 'm02', to: 'm03' },
      { id: 'c03', from: 'm03', to: 'm04' },
      { id: 'c04', from: 'm03', to: 'm05' },
      { id: 'c05', from: 'm04', to: 'm06' },
      { id: 'c06', from: 'm05', to: 'm07' },
      { id: 'c07', from: 'm05', to: 'm08' },
      { id: 'c08', from: 'm06', to: 'm09' },
      { id: 'c09', from: 'm09', to: 'm10' },
      { id: 'c10', from: 'm11', to: 'm12' },
    ],
  },
  {
    titleClear: {
      x: 20.0,
      y: 260.0,
      width: 318.0,
      height: 150.0,
    },
    motifs: [
      { id: 'm01', cx: 44.0, cy: 214.0, rotate: -20.0, sx: 0.2755, sy: 0.2755, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 98.5, cy: 174.4, rotate: -11.7, sx: 0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 143.3, cy: 119.4, rotate: -5.6, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 205.9, cy: 94.2, rotate: 2.7, sx: 0.2959, sy: 0.2959, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 262.7, cy: 51.6, rotate: 8.8, sx: 0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 326.4, cy: 43.3, rotate: -12.4, sx: -0.2857, sy: 0.2857, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 275.6, cy: 115.8, rotate: -17.7, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 219.1, cy: 165.2, rotate: 3.3, sx: -0.2959, sy: 0.2959, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 280.0, cy: 500.0, rotate: 8.0, sx: -0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm10', cx: 322.4, cy: 448.7, rotate: -28.0, sx: 0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
    ],
    connectors: [
      { id: 'c01', from: 'm01', to: 'm02' },
      { id: 'c02', from: 'm02', to: 'm03' },
      { id: 'c03', from: 'm03', to: 'm04' },
      { id: 'c04', from: 'm04', to: 'm05' },
      { id: 'c05', from: 'm05', to: 'm06' },
      { id: 'c06', from: 'm04', to: 'm07' },
      { id: 'c07', from: 'm07', to: 'm08' },
      { id: 'c08', from: 'm09', to: 'm10' },
    ],
  },
  {
    titleClear: {
      x: 20.0,
      y: 236.0,
      width: 220.0,
      height: 168.0,
    },
    motifs: [
      { id: 'm01', cx: 180.0, cy: 40.0, rotate: -6.0, sx: 0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm02', cx: 249.5, cy: 51.5, rotate: 17.8, sx: -0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm03', cx: 308.1, cy: 102.6, rotate: -3.2, sx: 0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
      { id: 'm04', cx: 297.8, cy: 170.2, rotate: 25.2, sx: -0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm05', cx: 310.1, cy: 242.4, rotate: 31.3, sx: -0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
      { id: 'm06', cx: 313.6, cy: 316.9, rotate: -27.1, sx: 0.2653, sy: 0.2653, ox: -143.0, oy: -97.0 },
      { id: 'm07', cx: 317.3, cy: 389.2, rotate: 16.3, sx: -0.2449, sy: 0.2449, ox: -143.0, oy: -97.0 },
      { id: 'm08', cx: 312.0, cy: 457.4, rotate: -12.1, sx: 0.2551, sy: 0.2551, ox: -143.0, oy: -97.0 },
      { id: 'm09', cx: 297.4, cy: 526.5, rotate: 31.3, sx: -0.2347, sy: 0.2347, ox: -143.0, oy: -97.0 },
    ],
    connectors: [
      { id: 'c01', from: 'm01', to: 'm02' },
      { id: 'c02', from: 'm02', to: 'm03' },
      { id: 'c03', from: 'm03', to: 'm04' },
      { id: 'c04', from: 'm04', to: 'm05' },
      { id: 'c05', from: 'm05', to: 'm06' },
      { id: 'c06', from: 'm06', to: 'm07' },
      { id: 'c07', from: 'm07', to: 'm08' },
      { id: 'c08', from: 'm08', to: 'm09' },
    ],
  },
] as const;
