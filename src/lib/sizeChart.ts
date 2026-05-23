export type NailShape = "short-round" | "short-oval";
export type SizeKey = "XS" | "S" | "M" | "L";

export const shapeLabels: Record<NailShape, string> = {
  "short-round": "Short Round",
  "short-oval":  "Short Oval",
};

// Arc/width (mm) per finger [thumb, index, middle, ring, pinky] from official Grippy size chart.
// Both shapes share identical arc/width values; shape affects nail length, not width.
export const sizeCharts: Record<NailShape, Record<SizeKey, readonly number[]>> = {
  "short-round": {
    XS: [14, 10, 11, 10, 8],
    S:  [15, 11, 12, 11, 9],
    M:  [16, 12, 13, 12, 10],
    L:  [17, 13, 14, 13, 11],
  },
  "short-oval": {
    XS: [14, 10, 11, 10, 8],
    S:  [15, 11, 12, 11, 9],
    M:  [16, 12, 13, 12, 10],
    L:  [17, 13, 14, 13, 11],
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

const SIZE_ORDER: SizeKey[] = ["XS", "S", "M", "L"];

export function getClosestSize(
  measurements: number[],
  shape: NailShape = "short-round"
): { size: SizeKey; confidence: number } {
  const chart = sizeCharts[shape];

  // Compute distance to each size
  const distances = (Object.entries(chart) as [SizeKey, readonly number[]][]).map(([size, widths]) => ({
    size,
    distance: Math.sqrt(measurements.reduce((sum, m, i) => sum + Math.pow(m - widths[i], 2), 0)),
  }));

  distances.sort((a, b) => a.distance - b.distance);
  const best   = distances[0];
  const second = distances[1];

  // If the two closest sizes are within 1mm of each other, size up for comfort
  // (press-ons can be filed down but not enlarged)
  let chosenSize = best.size;
  if (second.distance - best.distance < 1.0) {
    const bestIdx   = SIZE_ORDER.indexOf(best.size);
    const secondIdx = SIZE_ORDER.indexOf(second.size);
    if (secondIdx > bestIdx) chosenSize = second.size;
  }

  const maxDist  = 12;
  const confidence = Math.max(40, Math.round((1 - Math.min(best.distance, maxDist) / maxDist) * 100));

  return { size: chosenSize, confidence };
}

export const PIXELS_PER_MM = 5;

export function pixelsToMm(pixels: number, calibrationRatio = PIXELS_PER_MM): number {
  return Math.round((pixels / calibrationRatio) * 10) / 10;
}
