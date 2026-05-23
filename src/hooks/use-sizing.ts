import { useState, useCallback } from "react";
import { fingerOrder, FingerName, pixelsToMm, NailShape } from "@/lib/sizeChart";

export interface Point { x: number; y: number }

export interface CalibrationData {
  left: Point;
  right: Point;
  pixelsPerMm: number;
}

export type MeasurementMap       = Partial<Record<FingerName, number>>;
export type MeasurementPointsMap = Partial<Record<FingerName, { left: Point; right: Point }>>;
export type FingerImagesMap      = Partial<Record<FingerName, string>>;
export type FingerCalibrationsMap = Partial<Record<FingerName, CalibrationData>>;

export interface SizingState {
  step: number;
  hand: "left" | "right" | null;
  shape: NailShape | null;
  calibration: CalibrationData | null;         // active calibration (set per-finger photo)
  fingerCalibrations: FingerCalibrationsMap;   // persisted per-finger so undo restores it
  measurements: MeasurementMap;
  measurementPoints: MeasurementPointsMap;
  fingerImages: FingerImagesMap;
  currentFinger: number;
}

const initialState: SizingState = {
  step: 0,
  hand: null,
  shape: null,
  calibration: null,
  fingerCalibrations: {},
  measurements: {},
  measurementPoints: {},
  fingerImages: {},
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

  const setFingerImage = useCallback((finger: FingerName, url: string) => {
    setState(s => ({ ...s, fingerImages: { ...s.fingerImages, [finger]: url } }));
  }, []);

  // Store calibration for a specific finger and set it as the active calibration
  const setFingerCalibration = useCallback((finger: FingerName, left: Point, right: Point, referenceMm = 20) => {
    const pixelWidth   = Math.abs(right.x - left.x);
    const pixelsPerMm  = pixelWidth > 0 ? pixelWidth / referenceMm : 5;
    const cal: CalibrationData = { left, right, pixelsPerMm };
    setState(s => ({
      ...s,
      calibration: cal,
      fingerCalibrations: { ...s.fingerCalibrations, [finger]: cal },
    }));
  }, []);

  const recordMeasurement = useCallback((
    fingerIndex: number,
    _widthPx: number,
    left: Point,
    right: Point,
  ) => {
    const finger = fingerOrder[fingerIndex];
    setState(s => {
      const pixelsPerMm = s.calibration?.pixelsPerMm ?? 5;
      // Use horizontal X-distance only — consistent with how calibration is measured
      const widthPx     = Math.abs(right.x - left.x);
      const widthMm     = pixelsToMm(widthPx, pixelsPerMm);
      const next        = { ...s.measurements,      [finger]: widthMm };
      const nextPoints  = { ...s.measurementPoints, [finger]: { left, right } };
      const allDone     = fingerOrder.every(f => next[f] !== undefined);
      return {
        ...s,
        measurements:      next,
        measurementPoints: nextPoints,
        currentFinger:     allDone ? fingerIndex : fingerIndex + 1,
        step:              allDone ? 6 : 3,
      };
    });
  }, []);

  const undoMeasurement = useCallback(() => {
    setState(s => {
      const idx    = Math.max(0, s.currentFinger - 1);
      const finger = fingerOrder[idx];
      const next        = { ...s.measurements };
      const nextPoints  = { ...s.measurementPoints };
      delete next[finger];
      delete nextPoints[finger];
      // Restore the calibration that was used for this finger's photo
      const restoredCal = s.fingerCalibrations[finger] ?? null;
      return {
        ...s,
        measurements:      next,
        measurementPoints: nextPoints,
        currentFinger:     idx,
        calibration:       restoredCal,
      };
    });
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const getMeasurementArray = useCallback((s: SizingState): number[] => {
    return fingerOrder.map(f => s.measurements[f] ?? 0);
  }, []);

  return {
    state,
    setStep,
    setHand,
    setShape,
    setFingerImage,
    setFingerCalibration,
    recordMeasurement,
    undoMeasurement,
    getMeasurementArray,
    reset,
  };
}
