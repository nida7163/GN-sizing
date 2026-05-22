export const sizeChart = {
  XS: [14, 11, 12, 11, 8],
  S:  [15, 12, 13, 12, 9],
  M:  [16, 13, 14, 13, 10],
  L:  [17, 14, 15, 14, 11],
} as const;

export type SizeKey = keyof typeof sizeChart;
export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export const fingerLabels: Record<FingerName, string> = {
  thumb:  "Thumb",
  index:  "Index",
  middle: "Middle",
  ring:   "Ring",
  pinky:  "Pinky",
};

export const fingerOrder: FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

export interface SizeResult {
  size: SizeKey;
  confidence: number;
  individualWidths: Record<FingerName, number>;
}

export function getClosestSize(measurements: number[]): { size: SizeKey; confidence: number } {
  let bestSize: SizeKey = "M";
  let bestDistance = Infinity;

  for (const [size, widths] of Object.entries(sizeChart) as [SizeKey, readonly number[]][]) {
    const distance = Math.sqrt(
      measurements.reduce((sum, m, i) => sum + Math.pow(m - widths[i], 2), 0)
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSize = size;
    }
  }

  // Convert distance to 0–100 confidence
  const maxDist = 8;
  const confidence = Math.max(30, Math.round((1 - Math.min(bestDistance, maxDist) / maxDist) * 100));

  return { size: bestSize, confidence };
}

// 100 pixels = 20mm (placeholder calibration)
export const PIXELS_PER_MM = 5;

export function pixelsToMm(pixels: number, calibrationRatio = PIXELS_PER_MM): number {
  return Math.round((pixels / calibrationRatio) * 10) / 10;
}
