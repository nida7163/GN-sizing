import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Hand, Undo2 } from "lucide-react";
import { GrippyButton } from "@/components/grippy/Button";
import { ProgressBar } from "@/components/grippy/ProgressBar";
import { UploadCard } from "@/components/grippy/UploadCard";
import { MeasurementCanvas } from "@/components/grippy/MeasurementCanvas";
import { PageContainer } from "@/components/grippy/PageContainer";
import { useSizing } from "@/hooks/use-sizing";
import type { Point, MeasurementPointsMap, FingerImagesMap, FingerCalibrationsMap, MeasurementMap } from "@/hooks/use-sizing";
import { fingerOrder, fingerLabels, getClosestSize, NailShape } from "@/lib/sizeChart";
import type { FingerName } from "@/lib/sizeChart";

const PROGRESS_TOTAL = 8; // 0=Landing, 1=Hand, 2=Shape, 3–7=Thumb–Pinky

const REF_OBJECTS = [
  { label: "Penny / Dime", mm: 19 },
  { label: "Quarter",      mm: 24 },
  { label: "Credit card",  mm: 54 },
] as const;

// ── Nail shape SVG ────────────────────────────────────────────────────────────
function NailShapeIcon({ shape }: { shape: NailShape }) {
  if (shape === "short-round") {
    return (
      <svg width="44" height="48" viewBox="0 0 44 48" fill="none" className="text-grippy-black">
        <path d="M4 24 L4 44 Q4 46 6 46 L38 46 Q40 46 40 44 L40 24 Q40 4 22 4 Q4 4 4 24 Z"
          stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="36" height="52" viewBox="0 0 36 52" fill="none" className="text-grippy-black">
      <path d="M4 30 L4 48 Q4 50 6 50 L30 50 Q32 50 32 48 L32 30 Q32 4 18 4 Q4 4 4 30 Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Frozen canvas: static measurement overlay for review ─────────────────────
function FrozenCanvas({ imageUrl, left, right }: { imageUrl: string; left: Point; right: Point }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas    = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const maxW    = container.clientWidth;
      canvas.width  = maxW;
      canvas.height = maxW * (img.naturalHeight / img.naturalWidth);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const drawMarker = (p: Point) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#0D0D0D"; ctx.globalAlpha = 0.25; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#0D0D0D"; ctx.fill();
      };
      drawMarker(left);
      drawMarker(right);
      ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
      ctx.strokeStyle = "#0D0D0D"; ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "bold 13px 'DM Mono', monospace";
      ctx.fillStyle = "#0D0D0D"; ctx.textAlign = "center";
      ctx.fillText(
        `${Math.round(Math.hypot(right.x - left.x, right.y - left.y))}px`,
        (left.x + right.x) / 2, (left.y + right.y) / 2 - 14,
      );
    };
    img.src = imageUrl;
  }, [imageUrl, left, right]);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden bg-grippy-black shadow-md">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}

// ── Step 0: Landing ───────────────────────────────────────────────────────────
function LandingStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6 max-w-xs"
      >
        <div className="w-16 h-16 rounded-2xl bg-grippy-cobalt flex items-center justify-center shadow-lg">
          <span className="font-unbounded text-2xl font-black text-grippy-cream">G</span>
        </div>
        <div className="space-y-3">
          <h1 className="font-unbounded text-3xl font-bold text-grippy-black leading-tight">
            Find Your<br />Perfect Fit
          </h1>
          <p className="font-mono text-sm text-grippy-black/50 leading-relaxed">
            A fast sizing experience built<br />for Grippy press-ons.
          </p>
        </div>
        <GrippyButton size="lg" fullWidth onClick={onStart}>Start Sizing</GrippyButton>
        <p className="font-mono text-[10px] text-grippy-black/30 uppercase tracking-widest">
          Takes ~2 minutes
        </p>
      </motion.div>
    </div>
  );
}

// ── Step 1: Hand selection ────────────────────────────────────────────────────
function HandStep({ onSelect }: { onSelect: (hand: "left" | "right") => void }) {
  return (
    <div className="flex flex-col gap-8 px-6 pt-8">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 1 of 2</p>
        <h2 className="font-unbounded text-2xl font-bold text-grippy-black">Which hand<br />are you sizing?</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["left", "right"] as const).map(side => (
          <motion.button
            key={side} whileTap={{ scale: 0.95 }} onClick={() => onSelect(side)}
            className="flex flex-col items-center gap-4 bg-grippy-cream border-2 border-grippy-black/10 rounded-3xl p-8 active:border-grippy-black transition-colors"
          >
            <Hand size={40} className="text-grippy-black" style={{ transform: side === "right" ? "scaleX(-1)" : "none" }} />
            <span className="font-unbounded text-sm font-semibold text-grippy-black capitalize">{side} Hand</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Shape selection ───────────────────────────────────────────────────
function ShapeStep({ onSelect }: { onSelect: (shape: NailShape) => void }) {
  const shapes: { id: NailShape; label: string; description: string }[] = [
    { id: "short-round", label: "Short Round", description: "Classic rounded edge" },
    { id: "short-oval",  label: "Short Oval",  description: "Softly tapered sides" },
  ];
  return (
    <div className="flex flex-col gap-8 px-6 pt-8">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 2 of 2</p>
        <h2 className="font-unbounded text-2xl font-bold text-grippy-black">Which shape<br />are you sizing for?</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {shapes.map(({ id, label, description }) => (
          <motion.button
            key={id} whileTap={{ scale: 0.95 }} onClick={() => onSelect(id)}
            className="flex flex-col items-center gap-5 bg-grippy-cream border-2 border-grippy-black/10 rounded-3xl p-8 active:border-grippy-black transition-colors"
          >
            <NailShapeIcon shape={id} />
            <div className="text-center space-y-1">
              <p className="font-unbounded text-sm font-semibold text-grippy-black">{label}</p>
              <p className="font-mono text-[10px] text-grippy-black/40">{description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Step 3: Per-finger photo → calibrate → measure ────────────────────────────
type FingerPhase = "photo" | "calibrate" | "measure";

function MeasureStep({
  currentFinger,
  fingerImages,
  fingerCalibrations,
  measurementPoints,
  measurements,
  onSetFingerImage,
  onCalibrate,
  onMeasure,
  onUndo,
}: {
  currentFinger: number;
  fingerImages: FingerImagesMap;
  fingerCalibrations: FingerCalibrationsMap;
  measurementPoints: MeasurementPointsMap;
  measurements: MeasurementMap;
  onSetFingerImage: (finger: FingerName, url: string) => void;
  onCalibrate: (finger: FingerName, left: Point, right: Point, referenceMm?: number) => void;
  onMeasure: (fingerIdx: number, distPx: number, left: Point, right: Point) => void;
  onUndo: () => void;
}) {
  const finger = fingerOrder[currentFinger];
  const label  = fingerLabels[finger];

  const [phase, setPhase] = useState<FingerPhase>(() => {
    if (!fingerImages[finger])       return "photo";
    if (!fingerCalibrations[finger]) return "calibrate";
    return "measure";
  });

  const [photoUrl,    setPhotoUrl]    = useState<string | null>(fingerImages[finger] ?? null);
  const [refIdx,      setRefIdx]      = useState(1); // default: Quarter
  const [reviewIdx,   setReviewIdx]   = useState<number | null>(null);
  const [canvasKey,   setCanvasKey]   = useState(0);
  const [calCanvasKey, setCalCanvasKey] = useState(0);
  const [measureWarn, setMeasureWarn] = useState<{ mm: number; dist: number; left: Point; right: Point } | null>(null);
  const [calWarn,     setCalWarn]     = useState<{ dist: number; left: Point; right: Point } | null>(null);

  const handlePhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    onSetFingerImage(finger, url);
    setPhotoUrl(url);
    setPhase("calibrate");
  };

  const commitCalibrate = (left: Point, right: Point) => {
    onCalibrate(finger, left, right, REF_OBJECTS[refIdx].mm);
    setCalWarn(null);
    setPhase("measure");
  };

  const handleCalibrateAttempt = (_dist: number, left: Point, right: Point) => {
    const pixelWidth  = Math.abs(right.x - left.x);
    const pixelsPerMm = pixelWidth / REF_OBJECTS[refIdx].mm;
    if (pixelsPerMm < 0.5 || pixelsPerMm > 30) {
      setCalWarn({ dist: _dist, left, right });
    } else {
      commitCalibrate(left, right);
    }
  };

  const handleRetakePhoto = () => {
    setPhotoUrl(null);
    setMeasureWarn(null);
    setPhase("photo");
  };

  const handleMeasureAttempt = (dist: number, left: Point, right: Point) => {
    const ppm     = fingerCalibrations[finger]?.pixelsPerMm ?? 5;
    const widthMm = Math.abs(right.x - left.x) / ppm;
    if (widthMm < 5 || widthMm > 25) {
      setMeasureWarn({ mm: widthMm, dist, left, right });
    } else {
      onMeasure(currentFinger, dist, left, right);
    }
  };

  const handleChipClick = (i: number) => {
    if (i >= currentFinger) return;
    setReviewIdx(prev => prev === i ? null : i);
  };

  // ── Finger chip row ───────────────────────────────────────────────────────
  const chipRow = (
    <div className="flex items-center gap-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
        {fingerOrder.map((f, i) => {
          const done      = measurements[f] !== undefined;
          const active    = i === currentFinger;
          const reviewing = reviewIdx === i;
          return (
            <button
              key={f}
              onClick={() => handleChipClick(i)}
              disabled={!done}
              className={[
                "shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all",
                done && reviewing
                  ? "bg-grippy-cobalt text-grippy-cream ring-2 ring-grippy-cobalt ring-offset-1"
                  : done   ? "bg-grippy-cobalt text-grippy-cream"
                  : active ? "bg-grippy-black text-grippy-cream"
                           : "bg-grippy-black/10 text-grippy-black/40",
              ].join(" ")}
            >
              {fingerLabels[f]}
            </button>
          );
        })}
      </div>
      {currentFinger > 0 && (
        <button
          onClick={onUndo}
          className="shrink-0 flex items-center gap-1 font-mono text-[10px] text-grippy-black/50 active:text-grippy-black transition-colors border border-grippy-black/15 rounded-full px-2.5 py-1.5"
        >
          <Undo2 size={11} />
          Redo {fingerLabels[finger]}
        </button>
      )}
    </div>
  );

  // ── Review panel ─────────────────────────────────────────────────────────
  const reviewPts = reviewIdx !== null ? measurementPoints[fingerOrder[reviewIdx]] : undefined;
  const reviewImg = reviewIdx !== null ? fingerImages[fingerOrder[reviewIdx]]      : undefined;

  const reviewPanel = (
    <AnimatePresence>
      {reviewIdx !== null && reviewPts && reviewImg && (
        <motion.div
          key={`review-${reviewIdx}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-2 pb-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
              {fingerLabels[fingerOrder[reviewIdx]]} — tap chip again to close
            </p>
            <FrozenCanvas imageUrl={reviewImg} left={reviewPts.left} right={reviewPts.right} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Phase: photo ──────────────────────────────────────────────────────────
  if (phase === "photo") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            Finger {currentFinger + 1} of 5 · {label}
          </p>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">
            Photo your {label}
          </h2>
        </div>

        {chipRow}
        {reviewPanel}

        <div className="bg-grippy-black/5 rounded-2xl px-4 py-4 space-y-2">
          <p className="font-unbounded text-xs font-semibold text-grippy-black">Tips:</p>
          <ul className="space-y-2">
            {[
              `Rest your ${label.toLowerCase()} flat on a table, nail facing up`,
              `Place the ${REF_OBJECTS[refIdx].label.toLowerCase()} flat on the same table right beside your nail — not under or over it`,
              "Hold your phone directly above, pointing straight down",
              "Get close so the nail fills most of the frame",
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2 font-mono text-[11px] text-grippy-black/60 leading-relaxed">
                <span className="text-grippy-black/30 mt-0.5 shrink-0">—</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <UploadCard onFile={handlePhoto} />
      </div>
    );
  }

  // ── Phase: calibrate ──────────────────────────────────────────────────────
  if (phase === "calibrate") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            Finger {currentFinger + 1} of 5 · {label}
          </p>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">
            Calibrate the photo
          </h2>
          <p className="font-mono text-sm text-grippy-black/50">
            Tap the left then right edge of your reference object.
          </p>
        </div>

        {chipRow}

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            What reference object did you use?
          </p>
          <div className="flex gap-2">
            {REF_OBJECTS.map((obj, i) => (
              <button
                key={obj.label}
                onClick={() => setRefIdx(i)}
                className={[
                  "px-3 py-1.5 rounded-full font-mono text-[10px] border transition-all",
                  i === refIdx
                    ? "bg-grippy-black text-grippy-cream border-grippy-black"
                    : "bg-transparent text-grippy-black/50 border-grippy-black/20 active:border-grippy-black",
                ].join(" ")}
              >
                {obj.label}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] text-grippy-black/30">
            {REF_OBJECTS[refIdx].mm} mm assumed width
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-grippy-black/50">
            Tap the outer edges of the {REF_OBJECTS[refIdx].label.toLowerCase()}
          </span>
          <button
            onClick={handleRetakePhoto}
            className="font-mono text-[11px] text-grippy-black/40 underline underline-offset-2 active:text-grippy-black ml-4 shrink-0"
          >
            Retake photo
          </button>
        </div>

        <MeasurementCanvas
          key={`cal-${currentFinger}-${photoUrl}-${calCanvasKey}`}
          imageUrl={photoUrl!}
          prompt={`Tap both edges of the ${REF_OBJECTS[refIdx].label.toLowerCase()}`}
          onMeasure={handleCalibrateAttempt}
        />

        <AnimatePresence>
          {calWarn && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-3"
            >
              <p className="font-mono text-xs text-amber-800 leading-relaxed">
                Those points seem too close or too far apart — did you tap the outer edges of the {REF_OBJECTS[refIdx].label.toLowerCase()}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCalWarn(null); setCalCanvasKey(k => k + 1); }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-100 font-mono text-xs text-amber-800 font-medium active:bg-amber-200 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => commitCalibrate(calWarn.left, calWarn.right)}
                  className="flex-1 py-2.5 rounded-xl bg-grippy-black/5 font-mono text-xs text-grippy-black/60 active:bg-grippy-black/10 transition-colors"
                >
                  Accept Anyway
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Phase: measure ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
          Finger {currentFinger + 1} of 5 · {label}
        </p>
        <h2 className="font-unbounded text-xl font-bold text-grippy-black">
          Measure your {label}
        </h2>
      </div>

      {chipRow}
      {reviewPanel}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-grippy-black/50">
          Tap the <span className="text-grippy-black font-medium">widest point</span> near the base of your {label} nail
        </span>
        <button
          onClick={handleRetakePhoto}
          className="font-mono text-[11px] text-grippy-black/40 underline underline-offset-2 active:text-grippy-black ml-4 shrink-0"
        >
          Retake photo
        </button>
      </div>

      <MeasurementCanvas
        key={`measure-${currentFinger}-${photoUrl}-${canvasKey}`}
        imageUrl={photoUrl!}
        prompt={`Tap the widest part of your ${label} nail (near base)`}
        onMeasure={handleMeasureAttempt}
        lineColor="#0D0D0D"
      />

      <AnimatePresence>
        {measureWarn && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-3"
          >
            <p className="font-mono text-xs text-amber-800 leading-relaxed">
              That measures {measureWarn.mm.toFixed(1)} mm — typical nails are 8–20 mm wide. Did you tap the right spots?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setMeasureWarn(null); setCanvasKey(k => k + 1); }}
                className="flex-1 py-2.5 rounded-xl bg-amber-100 font-mono text-xs text-amber-800 font-medium active:bg-amber-200 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => { onMeasure(currentFinger, measureWarn.dist, measureWarn.left, measureWarn.right); setMeasureWarn(null); }}
                className="flex-1 py-2.5 rounded-xl bg-grippy-black/5 font-mono text-xs text-grippy-black/60 active:bg-grippy-black/10 transition-colors"
              >
                Accept Anyway
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Size page ────────────────────────────────────────────────────────────
export default function Size() {
  const navigate = useNavigate();
  const {
    state,
    setStep,
    setHand,
    setShape,
    setFingerImage,
    setFingerCalibration,
    recordMeasurement,
    undoMeasurement,
    getMeasurementArray,
    restoreForRetake,
  } = useSizing();

  useEffect(() => {
    const raw = sessionStorage.getItem("grippy_retake");
    if (!raw) return;
    sessionStorage.removeItem("grippy_retake");
    try {
      const { hand, shape, measurements, fingerIdx } = JSON.parse(raw);
      restoreForRetake(hand, shape, measurements, fingerIdx);
    } catch { /* ignore malformed data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = () => {
    if (state.step === 0) return;
    if (state.step >= 3) {
      if (state.currentFinger === 0) {
        setStep(2);
      } else {
        undoMeasurement();
      }
      return;
    }
    setStep(state.step - 1);
  };

  useEffect(() => {
    if (state.step === 6 && Object.keys(state.measurements).length === fingerOrder.length) {
      const arr = getMeasurementArray(state);
      const { size, confidence, sizedUp, originalSize } = getClosestSize(arr, state.shape ?? "short-round");
      sessionStorage.setItem(
        "grippy_result",
        JSON.stringify({ size, confidence, sizedUp, originalSize, measurements: state.measurements, hand: state.hand, shape: state.shape })
      );
      navigate("/results");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.measurements]);

  const progressStep = state.step < 3 ? state.step : 2 + state.currentFinger + 1;

  return (
    <div className="min-h-screen grippy-surface flex flex-col">
      {state.step > 0 && (
        <div className="flex items-center justify-between px-6 pt-safe pb-4 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-grippy-black/60 font-unbounded text-xs font-semibold active:text-grippy-black transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="font-unbounded text-xs font-black text-grippy-cobalt tracking-tight">
            GRIPPY
          </span>
        </div>
      )}

      {state.step > 0 && state.step < 6 && (
        <div className="px-0 pt-2 pb-4">
          <ProgressBar current={progressStep} total={PROGRESS_TOTAL} />
        </div>
      )}

      <div className="flex-1 pb-safe">
        <AnimatePresence mode="wait">
          {state.step === 0 && (
            <PageContainer key="landing" stepKey="landing">
              <LandingStep onStart={() => setStep(1)} />
            </PageContainer>
          )}
          {state.step === 1 && (
            <PageContainer key="hand" stepKey="hand">
              <HandStep onSelect={setHand} />
            </PageContainer>
          )}
          {state.step === 2 && (
            <PageContainer key="shape" stepKey="shape">
              <ShapeStep onSelect={setShape} />
            </PageContainer>
          )}
          {state.step === 3 && (
            <PageContainer key={`finger-${state.currentFinger}`} stepKey={`finger-${state.currentFinger}`}>
              <MeasureStep
                key={`measure-${state.currentFinger}`}
                currentFinger={state.currentFinger}
                fingerImages={state.fingerImages}
                fingerCalibrations={state.fingerCalibrations}
                measurementPoints={state.measurementPoints}
                measurements={state.measurements}
                onSetFingerImage={setFingerImage}
                onCalibrate={setFingerCalibration}
                onMeasure={recordMeasurement}
                onUndo={undoMeasurement}
              />
            </PageContainer>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
