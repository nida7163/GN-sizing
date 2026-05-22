import { useState, useCallback } from "react";
import { fingerOrder, FingerName, pixelsToMm, NailShape } from "@/lib/sizeChart";

export interface Point { x: number; y: number }

export interface CalibrationData {
  left: Point;
  right: Point;
  pixelsPerMm: number;
}

export type MeasurementMap = Partial<Record<FingerName, number>>;

export interface SizingState {
  step: number;
  hand: "left" | "right" | null;
  shape: NailShape | null;
  imageFile: File | null;
  imageUrl: string | null;
  calibration: CalibrationData | null;
  measurements: MeasurementMap;
  currentFinger: number;
}

const initialState: SizingState = {
  step: 0,
  hand: null,
  shape: null,
  imageFile: null,
  imageUrl: null,
  calibration: null,
  measurements: {},
  currentFinger: 0,
};

export function useSizing() {
  const [state, setState] = useState<SizingState>(initialState);

  const setStep = useCallback((step: number) => {
    setState(s => ({ ...s, step }));
  }, []);

  const setHand = useCallback((hand: "left" | "right") => {
    setState(s => ({ ...s, hand, step: 2 }));
  }, []);

  const setShape = useCallback((shape: NailShape) => {
    setState(s => ({ ...s, shape, step: 3 }));
  }, []);

  const setImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setState(s => ({ ...s, imageFile: file, imageUrl: url }));
  }, []);

  const setCalibration = useCallback((left: Point, right: Point) => {
    const pixelWidth = Math.abs(right.x - left.x);
    const pixelsPerMm = pixelWidth > 0 ? pixelWidth / 20 : 5;
    setState(s => ({ ...s, calibration: { left, right, pixelsPerMm }, step: 5 }));
  }, []);

  const recordMeasurement = useCallback((fingerIndex: number, widthPx: number) => {
    const finger = fingerOrder[fingerIndex];
    setState(s => {
      const pixelsPerMm = s.calibration?.pixelsPerMm ?? 5;
      const widthMm = pixelsToMm(widthPx, pixelsPerMm);
      const next: MeasurementMap = { ...s.measurements, [finger]: widthMm };
      const allDone = fingerOrder.every(f => next[f] !== undefined);
      return {
        ...s,
        measurements: next,
        currentFinger: allDone ? fingerIndex : fingerIndex + 1,
        step: allDone ? 6 : 5,
      };
    });
  }, []);

  const undoMeasurement = useCallback(() => {
    setState(s => {
      const idx = Math.max(0, s.currentFinger - 1);
      const finger = fingerOrder[idx];
      const next = { ...s.measurements };
      delete next[finger];
      return { ...s, measurements: next, currentFinger: idx };
    });
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const getMeasurementArray = useCallback((s: SizingState): number[] => {
    return fingerOrder.map(f => s.measurements[f] ?? 0);
  }, []);

  return {
    state,
    setStep,
    setHand,
    setShape,
    setImage,
    setCalibration,
    recordMeasurement,
    undoMeasurement,
    getMeasurementArray,
    reset,
  };
}
