import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Hand, Loader2, AlertCircle } from "lucide-react";
import { GrippyButton } from "@/components/grippy/Button";
import { ProgressBar } from "@/components/grippy/ProgressBar";
import { UploadCard } from "@/components/grippy/UploadCard";
import { PageContainer } from "@/components/grippy/PageContainer";
import { useSizing } from "@/hooks/use-sizing";
import type { Point, MeasurementPointsMap, FingerImagesMap } from "@/hooks/use-sizing";
import { fingerOrder, fingerLabels, getClosestSize, NailShape } from "@/lib/sizeChart";
import type { FingerName } from "@/lib/sizeChart";
import { analyzeNailPhoto } from "@/lib/analyze-nail";
import type { NailAnalysis } from "@/lib/analyze-nail";

const PROGRESS_TOTAL = 8;

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

// ── Canvas helpers ────────────────────────────────────────────────────────────
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(x, y, 5,  0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
}

// ── Detection preview canvas ──────────────────────────────────────────────────
function DetectionCanvas({
  imageUrl,
  analysis,
  referenceMm,
  onNaturalSize,
}: {
  imageUrl: string;
  analysis: NailAnalysis;
  referenceMm: number;
  onNaturalSize: (w: number, h: number) => void;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas    = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth;
      const h = w * (img.naturalHeight / img.naturalWidth);
      canvas.width  = w;
      canvas.height = h;
      onNaturalSize(img.naturalWidth, img.naturalHeight);

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      // Reference object line (blue)
      const refLx = analysis.ref_left  * w;
      const refRx = analysis.ref_right * w;
      const refY  = h * 0.78;
      line(ctx, refLx, refY, refRx, refY, "#3B82F6");
      dot(ctx, refLx, refY, "#3B82F6");
      dot(ctx, refRx, refY, "#3B82F6");
      ctx.font = "bold 11px 'DM Mono', monospace";
      ctx.fillStyle = "#3B82F6"; ctx.textAlign = "center";
      ctx.fillText("ref", (refLx + refRx) / 2, refY - 12);

      // Nail line (dark)
      const nailLx = analysis.nail_left  * w;
      const nailRx = analysis.nail_right * w;
      const nailY  = analysis.nail_y     * h;
      line(ctx, nailLx, nailY, nailRx, nailY, "#0D0D0D");
      dot(ctx, nailLx, nailY, "#0D0D0D");
      dot(ctx, nailRx, nailY, "#0D0D0D");

      const nailMm = (analysis.nail_right - analysis.nail_left)
                   / (analysis.ref_right  - analysis.ref_left)
                   * referenceMm;
      ctx.fillStyle = "#0D0D0D"; ctx.textAlign = "center";
      ctx.fillText(`${nailMm.toFixed(1)} mm`, (nailLx + nailRx) / 2, nailY - 12);
    };
    img.src = imageUrl;
  }, [imageUrl, analysis, referenceMm, onNaturalSize]);

  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden bg-grippy-black shadow-xl">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}

// ── Frozen canvas: static overlay for completed-finger review ─────────────────
function FrozenCanvas({ imageUrl, left, right }: { imageUrl: string; left: Point; right: Point }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas    = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const w = container.clientWidth;
      canvas.width  = w;
      canvas.height = w * (img.naturalHeight / img.naturalWidth);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      dot(ctx, left.x,  left.y,  "#0D0D0D");
      dot(ctx, right.x, right.y, "#0D0D0D");
      line(ctx, left.x, left.y, right.x, right.y, "#0D0D0D");
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
    <div className="flex flex-col gap-8 px-6 pt-4">
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
    <div className="flex flex-col gap-8 px-6 pt-4">
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

// ── Step 3: Per-finger auto-detection flow ────────────────────────────────────
type FingerPhase = "photo" | "analyzing" | "confirm" | "error";

function MeasureStep({
  currentFinger,
  fingerImages,
  measurementPoints,
  onSetFingerImage,
  onCalibrate,
  onMeasure,
  onUndo,
}: {
  currentFinger: number;
  fingerImages: FingerImagesMap;
  measurementPoints: MeasurementPointsMap;
  onSetFingerImage: (finger: FingerName, url: string) => void;
  onCalibrate: (finger: FingerName, left: Point, right: Point, referenceMm?: number) => void;
  onMeasure: (fingerIdx: number, distPx: number, left: Point, right: Point) => void;
  onUndo: () => void;
}) {
  const finger = fingerOrder[currentFinger];
  const label  = fingerLabels[finger];

  const [phase,       setPhase]       = useState<FingerPhase>("photo");
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(null);
  const [photoFile,   setPhotoFile]   = useState<File | null>(null);
  const [refIdx,      setRefIdx]      = useState(1); // default: Quarter
  const [analysis,    setAnalysis]    = useState<NailAnalysis | null>(null);
  const [_errorMsg,   setErrorMsg]    = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [reviewIdx,   setReviewIdx]   = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runAnalysis = async (file: File) => {
    setPhase("analyzing");
    setErrorMsg(null);
    try {
      const result = await analyzeNailPhoto(file, REF_OBJECTS[refIdx].label);
      setAnalysis(result);
      setPhase("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

  const handlePhoto = (file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoUrl(url);
    runAnalysis(file);
  };

  const handleConfirm = () => {
    if (!analysis || !photoUrl) return;
    const containerW = containerRef.current?.clientWidth ?? 390;
    const containerH = containerW * (naturalSize.h / naturalSize.w);

    const calLeft  = { x: analysis.ref_left  * containerW, y: containerH * 0.5 };
    const calRight = { x: analysis.ref_right  * containerW, y: containerH * 0.5 };
    const nailLeft  = { x: analysis.nail_left  * containerW, y: analysis.nail_y * containerH };
    const nailRight = { x: analysis.nail_right * containerW, y: analysis.nail_y * containerH };
    const nailWidthPx = (analysis.nail_right - analysis.nail_left) * containerW;

    onSetFingerImage(finger, photoUrl);
    onCalibrate(finger, calLeft, calRight, REF_OBJECTS[refIdx].mm);
    onMeasure(currentFinger, nailWidthPx, nailLeft, nailRight);
  };

  const handleRetake = () => {
    setPhotoUrl(null);
    setPhotoFile(null);
    setAnalysis(null);
    setErrorMsg(null);
    setPhase("photo");
  };

  const handleRetry = () => {
    if (photoFile) runAnalysis(photoFile);
  };

  // ── Chip row ──────────────────────────────────────────────────────────────
  const chipRow = (
    <div className="flex items-center gap-2 px-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
        {fingerOrder.map((f, i) => {
          const done   = i < currentFinger;
          const active = i === currentFinger;
          const reviewing = reviewIdx === i;
          return (
            <button
              key={f}
              onClick={() => done && setReviewIdx(prev => prev === i ? null : i)}
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
          className="shrink-0 font-mono text-[10px] text-grippy-black/50 active:text-grippy-black border border-grippy-black/15 rounded-full px-2.5 py-1.5"
        >
          Redo {fingerLabels[fingerOrder[currentFinger - 1]]}
        </button>
      )}
    </div>
  );

  // ── Review panel ──────────────────────────────────────────────────────────
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
          className="overflow-hidden px-2"
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
      <div className="flex flex-col gap-5 px-4 pt-4">
        <div className="px-2 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            Finger {currentFinger + 1} of 5 · {label}
          </p>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">
            Photo your {label}
          </h2>
        </div>

        {chipRow}
        {reviewPanel}

        {/* Reference object selector */}
        <div className="flex flex-col gap-2 px-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            What reference object will you place next to your finger?
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
                    : "bg-transparent text-grippy-black/50 border-grippy-black/20",
                ].join(" ")}
              >
                {obj.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-grippy-black/5 rounded-2xl px-4 py-3 space-y-2 mx-2">
          <p className="font-unbounded text-xs font-semibold text-grippy-black">Tips:</p>
          <ul className="space-y-1.5">
            {[
              `Lay your ${label.toLowerCase()} flat on a plain surface`,
              `Place a ${REF_OBJECTS[refIdx].label.toLowerCase()} next to your finger`,
              "Fill the frame — both finger and reference visible",
              "Get close for better accuracy",
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2 font-mono text-[11px] text-grippy-black/60">
                <span className="text-grippy-black/30 mt-0.5 shrink-0">—</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-2">
          <UploadCard onFile={handlePhoto} />
        </div>
      </div>
    );
  }

  // ── Phase: analyzing ──────────────────────────────────────────────────────
  if (phase === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-4 pt-4 min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        >
          <Loader2 size={36} className="text-grippy-cobalt" />
        </motion.div>
        <div className="text-center space-y-1">
          <p className="font-unbounded text-sm font-semibold text-grippy-black">Analyzing photo…</p>
          <p className="font-mono text-[11px] text-grippy-black/40">
            Detecting your {label} nail and reference object
          </p>
        </div>
      </div>
    );
  }

  // ── Phase: error ──────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="flex flex-col gap-5 px-4 pt-4">
        <div className="px-2 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            Finger {currentFinger + 1} of 5 · {label}
          </p>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">Detection failed</h2>
        </div>

        {chipRow}

        <div className="mx-2 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-unbounded text-xs font-semibold text-rose-700">Couldn't detect</p>
            <p className="font-mono text-[11px] text-rose-600/80 leading-relaxed">
              Make sure your finger and {REF_OBJECTS[refIdx].label.toLowerCase()} are both clearly visible in the photo.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-2">
          <GrippyButton fullWidth variant="outline" onClick={handleRetry}>
            Try again
          </GrippyButton>
          <GrippyButton fullWidth onClick={handleRetake}>
            Retake photo
          </GrippyButton>
        </div>
      </div>
    );
  }

  // ── Phase: confirm ────────────────────────────────────────────────────────
  const detectedMm = analysis
    ? ((analysis.nail_right - analysis.nail_left) / (analysis.ref_right - analysis.ref_left) * REF_OBJECTS[refIdx].mm).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4" ref={containerRef}>
      <div className="px-2 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
          Finger {currentFinger + 1} of 5 · {label}
        </p>
        <h2 className="font-unbounded text-xl font-bold text-grippy-black">
          Check the detection
        </h2>
        <p className="font-mono text-sm text-grippy-black/50">
          Blue line = reference · Dark line = nail
        </p>
      </div>

      {chipRow}

      {photoUrl && analysis && (
        <DetectionCanvas
          imageUrl={photoUrl}
          analysis={analysis}
          referenceMm={REF_OBJECTS[refIdx].mm}
          onNaturalSize={(w, h) => setNaturalSize({ w, h })}
        />
      )}

      <div className="flex items-center justify-between px-2">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Detected width</p>
          <p className="font-unbounded text-2xl font-bold text-grippy-black">{detectedMm} mm</p>
        </div>
        <button
          onClick={handleRetake}
          className="font-mono text-[11px] text-grippy-black/40 underline underline-offset-2 active:text-grippy-black"
        >
          Retake photo
        </button>
      </div>

      <div className="px-2">
        <GrippyButton fullWidth size="lg" onClick={handleConfirm}>
          Looks good — Next finger
        </GrippyButton>
      </div>
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
  } = useSizing();

  const goBack = () => {
    if (state.step === 0) return;
    if (state.step >= 3) {
      if (state.currentFinger === 0) setStep(2);
      else undoMeasurement();
      return;
    }
    setStep(state.step - 1);
  };

  useEffect(() => {
    if (state.step === 6 && Object.keys(state.measurements).length === fingerOrder.length) {
      const arr = getMeasurementArray(state);
      const { size, confidence } = getClosestSize(arr, state.shape ?? "short-round");
      sessionStorage.setItem(
        "grippy_result",
        JSON.stringify({ size, confidence, measurements: state.measurements, hand: state.hand, shape: state.shape }),
      );
      navigate("/results");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.measurements]);

  const progressStep = state.step < 3 ? state.step : 2 + state.currentFinger + 1;

  return (
    <div className="min-h-screen grippy-surface flex flex-col">
      {state.step > 0 && (
        <div className="flex items-center justify-between px-6 pt-safe pb-2 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
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

      <div className="flex-1 pb-10">
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
                measurementPoints={state.measurementPoints}
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
