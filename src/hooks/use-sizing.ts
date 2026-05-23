import { useState, useCallback, useEffect } from "react";
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
  calibration: CalibrationData | null;
  fingerCalibrations: FingerCalibrationsMap;
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

const STORAGE_KEY = "grippy_sizing";

// Always boot at step 0 so the landing page can offer Continue vs Start over.
// Blob URLs are tab-local and don't survive a reload — omit fingerImages.
function loadSavedState(): SizingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return { ...initialState, ...saved, fingerImages: {}, step: 0 };
  } catch {
    return initialState;
  }
}

export function useSizing() {
  const [state, setState] = useState<SizingState>(loadSavedState);

  // Persist whenever the user is mid-flow (steps 1–5).
  // step 0: don't touch storage — either truly blank, or user is on landing
  //         deciding whether to continue (their data must stay intact).
  // step 6: flow completed — clear storage.
  // reset() handles explicit clears directly so it doesn't depend on this effect.
  useEffect(() => {
    if (state.step >= 1 && state.step < 6) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fingerImages: _omit, ...persistable } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } else if (state.step >= 6) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

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

  // Clears localStorage immediately — don't wait for the persistence effect.
  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState);
  }, []);

  // Jump to the correct step based on how far the user previously got.
  const resume = useCallback(() => {
    setState(s => {
      if (s.hand === null)  return { ...s, step: 1 };
      if (s.shape === null) return { ...s, step: 2 };
      return { ...s, step: 3 };
    });
  }, []);

  const getMeasurementArray = useCallback((s: SizingState): number[] => {
    return fingerOrder.map(f => s.measurements[f] ?? 0);
  }, []);

  const restoreForRetake = useCallback((
    hand: "left" | "right",
    shape: NailShape,
    measurements: MeasurementMap,
    fingerIdx: number,
  ) => {
    setState({
      ...initialState,
      step: 3,
      hand,
      shape,
      measurements,
      currentFinger: fingerIdx,
    });
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
    resume,
    restoreForRetake,
  };
}
