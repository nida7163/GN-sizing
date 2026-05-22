import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Hand } from "lucide-react";
import { GrippyButton } from "@/components/grippy/Button";
import { ProgressBar } from "@/components/grippy/ProgressBar";
import { UploadCard } from "@/components/grippy/UploadCard";
import { MeasurementCanvas } from "@/components/grippy/MeasurementCanvas";
import { PageContainer } from "@/components/grippy/PageContainer";
import { useSizing } from "@/hooks/use-sizing";
import { fingerOrder, fingerLabels, getClosestSize, NailShape } from "@/lib/sizeChart";

const TOTAL_STEPS = 7;

// ── Nail shape SVG icon ──────────────────────────────────────────────────────
function NailShapeIcon({ shape }: { shape: NailShape }) {
  if (shape === "short-round") {
    return (
      <svg width="44" height="48" viewBox="0 0 44 48" fill="none" className="text-grippy-black">
        <path
          d="M4 24 L4 44 Q4 46 6 46 L38 46 Q40 46 40 44 L40 24 Q40 4 22 4 Q4 4 4 24 Z"
          stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="36" height="52" viewBox="0 0 36 52" fill="none" className="text-grippy-black">
      <path
        d="M4 30 L4 48 Q4 50 6 50 L30 50 Q32 50 32 48 L32 30 Q32 4 18 4 Q4 4 4 30 Z"
        stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Step 0: Landing ──────────────────────────────────────────────────────────
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
        <GrippyButton size="lg" fullWidth onClick={onStart}>
          Start Sizing
        </GrippyButton>
        <p className="font-mono text-[10px] text-grippy-black/30 uppercase tracking-widest">
          Takes ~2 minutes
        </p>
      </motion.div>
    </div>
  );
}

// ── Step 1: Hand selection ───────────────────────────────────────────────────
function HandStep({ onSelect }: { onSelect: (hand: "left" | "right") => void }) {
  return (
    <div className="flex flex-col gap-8 px-6 pt-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 1 of 5</p>
        <h2 className="font-unbounded text-2xl font-bold text-grippy-black">Which hand<br />are you sizing?</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["left", "right"] as const).map(side => (
          <motion.button
            key={side}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(side)}
            className="flex flex-col items-center gap-4 bg-grippy-cream border-2 border-grippy-black/10 rounded-3xl p-8 active:border-grippy-black transition-colors"
          >
            <Hand
              size={40}
              className="text-grippy-black"
              style={{ transform: side === "right" ? "scaleX(-1)" : "none" }}
            />
            <span className="font-unbounded text-sm font-semibold text-grippy-black capitalize">
              {side} Hand
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Shape selection ──────────────────────────────────────────────────
function ShapeStep({ onSelect }: { onSelect: (shape: NailShape) => void }) {
  const shapes: { id: NailShape; label: string; description: string }[] = [
    { id: "short-round", label: "Short Round", description: "Classic rounded edge" },
    { id: "short-oval",  label: "Short Oval",  description: "Softly tapered sides" },
  ];

  return (
    <div className="flex flex-col gap-8 px-6 pt-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 2 of 5</p>
        <h2 className="font-unbounded text-2xl font-bold text-grippy-black">Which shape<br />are you sizing for?</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {shapes.map(({ id, label, description }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(id)}
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

// ── Step 3: Photo upload ─────────────────────────────────────────────────────
function PhotoStep({
  preview,
  onFile,
  onNext,
}: {
  preview: string | null;
  onFile: (f: File) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-6 pt-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 3 of 5</p>
        <h2 className="font-unbounded text-2xl font-bold text-grippy-black">
          Upload a photo<br />of your hand
        </h2>
      </div>

      {/* Guided tips */}
      <div className="bg-grippy-black/5 rounded-2xl px-4 py-3 space-y-2">
        <p className="font-unbounded text-xs font-semibold text-grippy-black">For best results:</p>
        <ul className="space-y-1.5">
          {[
            "Lay hand flat on a plain, light surface",
            "Include a coin or credit card in the frame",
            "Good lighting — no shadows across your nails",
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2 font-mono text-[11px] text-grippy-black/60">
              <span className="text-grippy-black/30 mt-0.5 shrink-0">—</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <UploadCard onFile={onFile} preview={preview} />

      {preview && (
        <GrippyButton fullWidth onClick={onNext}>
          Looks good — Continue
        </GrippyButton>
      )}
    </div>
  );
}

// ── Step 4: Calibration ──────────────────────────────────────────────────────
function CalibrationStep({
  imageUrl,
  onDone,
}: {
  imageUrl: string;
  onDone: (distPx: number, l: { x: number; y: number }, r: { x: number; y: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <div className="px-2 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">Step 4 of 5</p>
        <h2 className="font-unbounded text-xl font-bold text-grippy-black">
          Calibrate with a reference object
        </h2>
        <p className="font-mono text-sm text-grippy-black/50">
          Tap the left then right edge of the coin or card in your photo.
        </p>
      </div>
      <MeasurementCanvas
        imageUrl={imageUrl}
        prompt="Tap both edges of your coin or card"
        onMeasure={(dist, l, r) => onDone(dist, l, r)}
      />
    </div>
  );
}

// ── Step 5: Nail measurement ─────────────────────────────────────────────────
function MeasureStep({
  imageUrl,
  currentFinger,
  onMeasure,
}: {
  imageUrl: string;
  currentFinger: number;
  onMeasure: (fingerIdx: number, distPx: number) => void;
}) {
  const finger = fingerOrder[currentFinger];
  const label = fingerLabels[finger];
  const remaining = fingerOrder.length - currentFinger;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <div className="px-2 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
          Step 5 of 5 · {remaining} nail{remaining !== 1 ? "s" : ""} left
        </p>
        <h2 className="font-unbounded text-xl font-bold text-grippy-black">
          Measure your nails
        </h2>
      </div>

      <div className="flex gap-2 px-2 overflow-x-auto no-scrollbar">
        {fingerOrder.map((f, i) => (
          <div
            key={f}
            className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-colors ${
              i < currentFinger
                ? "bg-grippy-cobalt text-grippy-cream"
                : i === currentFinger
                ? "bg-grippy-black text-grippy-cream"
                : "bg-grippy-black/10 text-grippy-black/40"
            }`}
          >
            {fingerLabels[f]}
          </div>
        ))}
      </div>

      <MeasurementCanvas
        key={currentFinger}
        imageUrl={imageUrl}
        prompt={`Tap both edges of your ${label}`}
        onMeasure={(dist) => onMeasure(currentFinger, dist)}
        lineColor="#0D0D0D"
      />
    </div>
  );
}

// ── Main Size page ───────────────────────────────────────────────────────────
export default function Size() {
  const navigate = useNavigate();
  const {
    state,
    setStep,
    setHand,
    setShape,
    setImage,
    setCalibration,
    recordMeasurement,
    getMeasurementArray,
  } = useSizing();

  const goBack = () => {
    if (state.step === 0) return;
    setStep(state.step - 1);
  };

  const handleCalibrationDone = (
    _distPx: number,
    l: { x: number; y: number },
    r: { x: number; y: number }
  ) => {
    setCalibration(l, r);
  };

  const handleNailMeasured = (fingerIdx: number, distPx: number) => {
    recordMeasurement(fingerIdx, distPx);
  };

  useEffect(() => {
    if (state.step === 6 && Object.keys(state.measurements).length === fingerOrder.length) {
      const arr = getMeasurementArray(state);
      const { size, confidence } = getClosestSize(arr, state.shape ?? "short-round");
      sessionStorage.setItem(
        "grippy_result",
        JSON.stringify({ size, confidence, measurements: state.measurements, hand: state.hand, shape: state.shape })
      );
      navigate("/results");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.measurements]);

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

      {state.step > 0 && state.step < TOTAL_STEPS && (
        <div className="px-0 pt-2 pb-4">
          <ProgressBar current={state.step} total={TOTAL_STEPS} />
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
            <PageContainer key="photo" stepKey="photo">
              <PhotoStep
                preview={state.imageUrl}
                onFile={setImage}
                onNext={() => setStep(4)}
              />
            </PageContainer>
          )}
          {state.step === 4 && state.imageUrl && (
            <PageContainer key="calibrate" stepKey="calibrate">
              <CalibrationStep imageUrl={state.imageUrl} onDone={handleCalibrationDone} />
            </PageContainer>
          )}
          {state.step === 5 && state.imageUrl && (
            <PageContainer key={`measure-${state.currentFinger}`} stepKey={`measure-${state.currentFinger}`}>
              <MeasureStep
                imageUrl={state.imageUrl}
                currentFinger={state.currentFinger}
                onMeasure={handleNailMeasured}
              />
            </PageContainer>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
