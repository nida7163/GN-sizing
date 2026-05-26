import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, Hand, Link, Undo2 } from "lucide-react";
import { GrippyButton } from "@/components/grippy/Button";
import { ProgressBar } from "@/components/grippy/ProgressBar";
import { UploadCard } from "@/components/grippy/UploadCard";
import { MeasurementCanvas } from "@/components/grippy/MeasurementCanvas";
import { PageContainer } from "@/components/grippy/PageContainer";
import { useSizing } from "@/hooks/use-sizing";
import type { Point, MeasurementPointsMap, FingerImagesMap, FingerCalibrationsMap, MeasurementMap } from "@/hooks/use-sizing";
import { fingerOrder, fingerLabels, getClosestSize, sizeCharts, NailShape } from "@/lib/sizeChart";
import type { FingerName, SizeKey } from "@/lib/sizeChart";

const PROGRESS_TOTAL = 8; // 0=Landing, 1=Hand, 2=Shape, 3–7=Thumb–Pinky

// Demo measurements: between S and M → triggers sized-up nudge, amber diffs visible
const DEMO_MEASUREMENTS: MeasurementMap = {
  thumb:  15.3,
  index:  11.6,
  middle: 12.4,
  ring:   11.5,
  pinky:   9.2,
};

function launchDemo(navigate: ReturnType<typeof useNavigate>) {
  const arr    = fingerOrder.map(f => DEMO_MEASUREMENTS[f] ?? 0);
  const result = getClosestSize(arr, "short-round");
  sessionStorage.setItem("grippy_result", JSON.stringify({
    ...result,
    measurements: DEMO_MEASUREMENTS,
    hand:         "right",
    shape:        "short-round",
    isGiftMode:   false,
  }));
  navigate("/results");
}

const REF_OBJECTS = [
  { label: "Penny / Dime", mm: 19 },
  { label: "Quarter",      mm: 24 },
  { label: "Credit card",  mm: 86 },
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
const STEPS_PREVIEW = [
  { label: "Pick your hand & shape", time: "10s" },
  { label: "Photo each finger (5×)", time: "30s each" },
  { label: "Tap 4 points per photo",  time: "fast" },
];

function getResumeLabel(state: { hand: "left" | "right" | null; shape: NailShape | null; currentFinger: number; measurements: MeasurementMap }): string {
  if (state.hand === null) return "hand selection";
  if (state.shape === null) return "shape selection";
  const measuredCount = fingerOrder.filter(f => state.measurements[f] !== undefined).length;
  if (measuredCount === 0) return "Thumb — finger 1 of 5";
  const label = fingerLabels[fingerOrder[state.currentFinger]] ?? "next finger";
  return `${label} — finger ${state.currentFinger + 1} of 5`;
}

function LandingStep({
  onStart,
  isGiftMode,
  hasSavedProgress,
  resumeLabel,
  onContinue,
  onStartOver,
  onDemo,
}: {
  onStart: () => void;
  isGiftMode: boolean;
  hasSavedProgress: boolean;
  resumeLabel: string;
  onContinue: () => void;
  onStartOver: () => void;
  onDemo: () => void;
}) {
  const [showGiftShare, setShowGiftShare] = useState(false);
  const [copied,        setCopied]        = useState(false);

  const handleShareGiftLink = async () => {
    const url  = `${window.location.origin}${window.location.pathname}?gift=1`;
    const text = "Find your Grippy Fit nail size in 2 minutes 💅";
    if (navigator.share) {
      try { await navigator.share({ title: "Grippy Fit Sizing", text, url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isGiftMode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6 max-w-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-grippy-cobalt flex items-center justify-center shadow-lg">
            <Gift size={28} className="text-grippy-cream" />
          </div>
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Someone's gifting you Grippy</p>
            <h1 className="font-unbounded text-3xl font-bold text-grippy-black leading-tight">
              Let's find<br />your size
            </h1>
            <p className="font-mono text-sm text-grippy-black/50 leading-relaxed">
              Measure your nails in ~2 minutes.<br />Share your size so they can order you the perfect set.
            </p>
          </div>

          <div className="w-full space-y-2 text-left">
            {STEPS_PREVIEW.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="font-mono text-[10px] w-4 text-grippy-black/30">{i + 1}</span>
                <span className="font-mono text-xs text-grippy-black/60 flex-1">{s.label}</span>
                <span className="font-mono text-[10px] text-grippy-black/30">{s.time}</span>
              </div>
            ))}
          </div>

          <GrippyButton size="lg" fullWidth onClick={onStart}>Find My Size</GrippyButton>
        </motion.div>
      </div>
    );
  }

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
            3 quick steps per finger.<br />Done in ~2 minutes.
          </p>
        </div>

        {/* What you'll do — reduces anxiety */}
        <div className="w-full space-y-2 text-left">
          {STEPS_PREVIEW.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="font-mono text-[10px] w-4 text-grippy-black/30">{i + 1}</span>
              <span className="font-mono text-xs text-grippy-black/60 flex-1">{s.label}</span>
              <span className="font-mono text-[10px] text-grippy-black/30">{s.time}</span>
            </div>
          ))}
        </div>

        {hasSavedProgress ? (
          /* Saved progress detected — offer continue or restart */
          <div className="w-full space-y-2">
            <GrippyButton size="lg" fullWidth onClick={onContinue}>
              Continue — {resumeLabel}
            </GrippyButton>
            <button
              onClick={onStartOver}
              className="w-full py-2.5 font-mono text-xs text-grippy-black/40 active:text-grippy-black/70 transition-colors"
            >
              Start over
            </button>
          </div>
        ) : (
          <GrippyButton size="lg" fullWidth onClick={onStart}>Start Sizing</GrippyButton>
        )}

        {/* Demo shortcut — skip photo flow for testing */}
        <button
          onClick={onDemo}
          className="font-mono text-[10px] text-grippy-black/20 active:text-grippy-black/40 transition-colors"
        >
          Demo mode
        </button>

        {/* Gift mode trigger */}
        <AnimatePresence mode="wait">
          {!showGiftShare ? (
            <motion.button
              key="gift-link"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGiftShare(true)}
              className="flex items-center gap-1.5 font-mono text-[11px] text-grippy-black/35 active:text-grippy-black/60 transition-colors"
            >
              <Gift size={12} />
              Gifting someone?
            </motion.button>
          ) : (
            <motion.div
              key="gift-panel"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="w-full bg-grippy-black/5 rounded-2xl px-4 py-4 space-y-3 text-left"
            >
              <p className="font-mono text-xs text-grippy-black/60 leading-relaxed">
                Send them this link — they measure their own nails in 2 min and share their size back to you.
              </p>
              <button
                onClick={handleShareGiftLink}
                className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl border border-grippy-black/15 font-mono text-xs text-grippy-black/70 active:bg-grippy-black/5 transition-colors"
              >
                <Link size={12} />
                {copied ? "Link copied!" : "Share sizing link"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
            <Hand size={40} className="text-grippy-black" style={{ transform: side === "left" ? "scaleX(-1)" : "none" }} />
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

const SIZE_ORDER: SizeKey[] = ["XS", "S", "M", "L"];

function MeasureStep({
  currentFinger,
  fingerImages,
  fingerCalibrations,
  measurementPoints,
  measurements,
  shape,
  refIdx,
  onRefIdxChange,
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
  shape: NailShape | null;
  refIdx: number;
  onRefIdxChange: (i: number) => void;
  onSetFingerImage: (finger: FingerName, url: string) => void;
  onCalibrate: (finger: FingerName, left: Point, right: Point, referenceMm?: number) => void;
  onMeasure: (fingerIdx: number, distPx: number, left: Point, right: Point) => void;
  onUndo: () => void;
}) {
  const finger = fingerOrder[currentFinger];
  const label  = fingerLabels[finger];

  const FINGER_MOTIVATION = ["Let's go!", "Nice one!", "Halfway!", "Almost there!", "Last one!"];
  const motivation = FINGER_MOTIVATION[currentFinger] ?? "";

  const [phase, setPhase] = useState<"photo" | "calibrate" | "measure">(() => {
    if (!fingerImages[finger])       return "photo";
    if (!fingerCalibrations[finger]) return "calibrate";
    return "measure";
  });

  const [photoUrl,     setPhotoUrl]    = useState<string | null>(fingerImages[finger] ?? null);
  const [reviewIdx,    setReviewIdx]   = useState<number | null>(null);
  const [canvasKey,    setCanvasKey]   = useState(0);
  const [calCanvasKey, setCalCanvasKey] = useState(0);
  const [measureWarn,  setMeasureWarn] = useState<{ mm: number; dist: number; left: Point; right: Point } | null>(null);
  const [calWarn,      setCalWarn]     = useState<{ dist: number; left: Point; right: Point } | null>(null);

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
    setCalWarn(null);
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
          Redo {fingerLabels[fingerOrder[currentFinger - 1]]}
        </button>
      )}
    </div>
  );

  // ── Review panel ─────────────────────────────────────────────────────────
  const reviewFinger = reviewIdx !== null ? fingerOrder[reviewIdx] : null;
  const reviewMm     = reviewFinger != null ? measurements[reviewFinger] : undefined;
  const reviewPts    = reviewFinger != null ? measurementPoints[reviewFinger] : undefined;
  const reviewImg    = reviewFinger != null ? fingerImages[reviewFinger]      : undefined;

  // Per-finger size comparison: which size does this single finger map to?
  const fingerSizeRanking = (reviewFinger != null && reviewMm != null && shape != null)
    ? SIZE_ORDER.map(sz => ({
        size: sz,
        target: sizeCharts[shape][sz][reviewIdx!],
        diff: reviewMm - sizeCharts[shape][sz][reviewIdx!],
      })).sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
    : null;
  const closestSize = fingerSizeRanking?.[0]?.size ?? null;

  const reviewPanel = (
    <AnimatePresence>
      {reviewIdx !== null && reviewFinger != null && reviewMm != null && (
        <motion.div
          key={`review-${reviewIdx}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="bg-grippy-black/[0.04] rounded-2xl px-4 py-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
                {fingerLabels[reviewFinger]}
              </p>
              <button
                onClick={() => setReviewIdx(null)}
                className="font-mono text-[10px] text-grippy-black/30 active:text-grippy-black/60"
              >
                close ×
              </button>
            </div>

            {/* Big mm + size comparison */}
            <div className="flex items-end gap-4">
              <div>
                <p className="font-unbounded text-3xl font-bold text-grippy-black tabular-nums leading-none">
                  {reviewMm.toFixed(1)}
                </p>
                <p className="font-mono text-[10px] text-grippy-black/40 mt-0.5">mm width</p>
              </div>
              {closestSize && (
                <div className="flex flex-col items-start gap-1 pb-0.5">
                  <p className="font-mono text-[10px] text-grippy-black/40">this finger →</p>
                  <div className="flex gap-1">
                    {SIZE_ORDER.map(sz => (
                      <span
                        key={sz}
                        className={[
                          "font-mono text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                          sz === closestSize
                            ? "bg-grippy-black text-grippy-cream border-grippy-black"
                            : "border-grippy-black/15 text-grippy-black/30",
                        ].join(" ")}
                      >
                        {sz}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Diff bar vs each size */}
            {fingerSizeRanking && (
              <div className="space-y-1.5">
                {fingerSizeRanking.map(({ size, target, diff }) => (
                  <div key={size} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] w-5 text-grippy-black/40">{size}</span>
                    <span className="font-mono text-[9px] text-grippy-black/30 w-12 tabular-nums">
                      {target} mm
                    </span>
                    <div className="flex-1 h-1 bg-grippy-black/8 rounded-full overflow-hidden">
                      <div
                        className={[
                          "h-full rounded-full",
                          Math.abs(diff) <= 0.5 ? "bg-emerald-500"
                          : Math.abs(diff) <= 1.5 ? "bg-amber-400"
                          : "bg-rose-400",
                        ].join(" ")}
                        style={{ width: `${Math.max(4, 100 - Math.abs(diff) * 20)}%` }}
                      />
                    </div>
                    <span className={[
                      "font-mono text-[9px] tabular-nums w-8 text-right",
                      Math.abs(diff) <= 0.5 ? "text-emerald-500"
                      : Math.abs(diff) <= 1.5 ? "text-amber-500"
                      : "text-rose-400",
                    ].join(" ")}>
                      {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Photo overlay if available in this session */}
            {reviewPts && reviewImg && (
              <FrozenCanvas imageUrl={reviewImg} left={reviewPts.left} right={reviewPts.right} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Phase stepper ─────────────────────────────────────────────────────────
  const PHASES = [
    { key: "photo",     short: "Photo" },
    { key: "calibrate", short: "Calibrate" },
    { key: "measure",   short: "Measure" },
  ] as const;
  const phaseIdx = PHASES.findIndex(p => p.key === phase);

  const phaseStepper = (
    <div className="flex items-center gap-2">
      {PHASES.map((p, i) => (
        <div key={p.key} className="flex items-center gap-2">
          <span className={[
            "font-mono text-[10px] transition-colors",
            i < phaseIdx  ? "text-grippy-black/30 line-through"
            : i === phaseIdx ? "text-grippy-black font-medium"
            :                  "text-grippy-black/20",
          ].join(" ")}>
            {p.short}
          </span>
          {i < PHASES.length - 1 && (
            <span className="font-mono text-[10px] text-grippy-black/15">→</span>
          )}
        </div>
      ))}
    </div>
  );

  // ── Phase: photo ──────────────────────────────────────────────────────────
  if (phase === "photo") {
    return (
      <div className="flex flex-col gap-6 px-5 pt-8">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
              Finger {currentFinger + 1} of 5
            </p>
            <span className="font-mono text-[10px] text-grippy-cobalt font-medium">{motivation}</span>
          </div>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">
            Photo your {label}
          </h2>
          {phaseStepper}
        </div>

        {chipRow}
        {reviewPanel}

        {/* Reference object picker — shown here so tips update before the photo is taken */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            What will you place beside your nail?
          </p>
          <div className="flex gap-2">
            {REF_OBJECTS.map((obj, i) => (
              <button
                key={obj.label}
                onClick={() => onRefIdxChange(i)}
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
        </div>

        <div className="bg-grippy-black/5 rounded-2xl px-4 py-4 space-y-2">
          <p className="font-unbounded text-xs font-semibold text-grippy-black">Tips:</p>
          <ul className="space-y-2">
            {[
              `Rest your ${label.toLowerCase()} flat on a table, nail facing up`,
              `Place the ${REF_OBJECTS[refIdx].label.toLowerCase()} flat beside your nail — horizontally (landscape) if using a card`,
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
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
              Finger {currentFinger + 1} of 5
            </p>
            <span className="font-mono text-[10px] text-grippy-cobalt font-medium">{motivation}</span>
          </div>
          <h2 className="font-unbounded text-xl font-bold text-grippy-black">
            Calibrate the photo
          </h2>
          {phaseStepper}
          <p className="font-mono text-sm text-grippy-black/50 pt-1">
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
                onClick={() => onRefIdxChange(i)}
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
          onImageError={handleRetakePhoto}
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
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            Finger {currentFinger + 1} of 5
          </p>
          <span className="font-mono text-[10px] text-grippy-cobalt font-medium">{motivation}</span>
        </div>
        <h2 className="font-unbounded text-xl font-bold text-grippy-black">
          Measure your {label}
        </h2>
        {phaseStepper}
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
        onImageError={handleRetakePhoto}
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
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const isGiftMode   = searchParams.get("gift") === "1";
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
    reset,
    resume,
    restoreForRetake,
  } = useSizing();

  const [refIdx, setRefIdx] = useState(2); // default: Credit card; lifted so it persists across fingers

  const hasSavedProgress = state.hand !== null || Object.keys(state.measurements).length > 0;
  const resumeLabel      = getResumeLabel(state);

  useEffect(() => {
    // Demo mode via URL param — skip the photo flow entirely
    if (searchParams.get("demo") === "1") {
      launchDemo(navigate);
      return;
    }
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
        JSON.stringify({ size, confidence, sizedUp, originalSize, isGiftMode, measurements: state.measurements, hand: state.hand, shape: state.shape })
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
            GRIPPY FIT
          </span>
          {/* Route back to landing where user can confirm restart — avoids accidental loss */}
          <button
            onClick={() => setStep(0)}
            className="font-mono text-[10px] text-grippy-black/35 active:text-grippy-black/60 transition-colors"
          >
            Start over
          </button>
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
              <LandingStep
                onStart={() => setStep(1)}
                isGiftMode={isGiftMode}
                hasSavedProgress={hasSavedProgress}
                resumeLabel={resumeLabel}
                onContinue={resume}
                onStartOver={reset}
                onDemo={() => launchDemo(navigate)}
              />
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
                shape={state.shape}
                refIdx={refIdx}
                onRefIdxChange={setRefIdx}
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
