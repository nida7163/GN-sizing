export type NailShape = "short-round" | "short-oval";
export type SizeKey = "XS" | "S" | "M" | "L";

export const shapeLabels: Record<NailShape, string> = {
  "short-round": "Short Round",
  "short-oval":  "Short Oval",
};

// Placeholder specs — replace with actual Grippy nail dimensions (mm) per shape
export const sizeCharts: Record<NailShape, Record<SizeKey, readonly number[]>> = {
  "short-round": {
    XS: [14, 11, 12, 11, 8],
    S:  [15, 12, 13, 12, 9],
    M:  [16, 13, 14, 13, 10],
    L:  [17, 14, 15, 14, 11],
  },
  "short-oval": {
    XS: [14, 11, 12, 11, 8],
    S:  [15, 12, 13, 12, 9],
    M:  [16, 13, 14, 13, 10],
    L:  [17, 14, 15, 14, 11],
  },
};

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

export function getClosestSize(
  measurements: number[],
  shape: NailShape = "short-round"
): { size: SizeKey; confidence: number } {
  const chart = sizeCharts[shape];
  let bestSize: SizeKey = "M";
  let bestDistance = Infinity;

  for (const [size, widths] of Object.entries(chart) as [SizeKey, readonly number[]][]) {
    const distance = Math.sqrt(
      measurements.reduce((sum, m, i) => sum + Math.pow(m - widths[i], 2), 0)
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSize = size;
    }
  }

  const maxDist = 8;
  const confidence = Math.max(30, Math.round((1 - Math.min(bestDistance, maxDist) / maxDist) * 100));

  return { size: bestSize, confidence };
}

export const PIXELS_PER_MM = 5;

export function pixelsToMm(pixels: number, calibrationRatio = PIXELS_PER_MM): number {
  return Math.round((pixels / calibrationRatio) * 10) / 10;
}
