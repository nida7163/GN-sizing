import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Share2 } from "lucide-react";
import { ResultCard } from "@/components/grippy/ResultCard";
import { GrippyButton } from "@/components/grippy/Button";
import { SizeKey, NailShape, shapeLabels, fingerOrder, fingerLabels, sizeCharts } from "@/lib/sizeChart";
import type { FingerName } from "@/lib/sizeChart";
import type { MeasurementMap } from "@/hooks/use-sizing";

interface GrippyResult {
  size: SizeKey;
  confidence: number;
  measurements: MeasurementMap;
  hand: "left" | "right";
  shape: NailShape;
}

export default function Results() {
  const navigate = useNavigate();
  const [result, setResult] = useState<GrippyResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("grippy_result");
    if (raw) {
      try { setResult(JSON.parse(raw)); }
      catch { navigate("/size"); }
    } else {
      navigate("/size");
    }
  }, [navigate]);

  const handleRetake = (finger: FingerName) => {
    if (!result) return;
    const fingerIdx   = fingerOrder.indexOf(finger);
    const measurements = { ...result.measurements };
    delete measurements[finger];
    sessionStorage.setItem("grippy_retake", JSON.stringify({
      hand: result.hand,
      shape: result.shape,
      measurements,
      fingerIdx,
    }));
    navigate("/size");
  };

  const handleShare = async () => {
    if (!result) return;
    const shapeName = shapeLabels[result.shape] ?? result.shape;
    const text = `My Grippy nail size is ${result.size} in ${shapeName}! Find yours at grippynails.com`;
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
  };

  if (!result) return null;

  const shapeName  = shapeLabels[result.shape] ?? result.shape;
  const chartSizes = sizeCharts[result.shape][result.size];

  return (
    <div className="min-h-screen grippy-surface flex flex-col">
      {/* Nav */}
      <div className="flex items-center justify-between px-6 pt-safe pb-4 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
        <button
          onClick={() => navigate("/size")}
          className="flex items-center gap-1.5 text-grippy-black/60 font-unbounded text-xs font-semibold active:text-grippy-black transition-colors"
        >
          <ArrowLeft size={16} />
          Resize
        </button>
        <span className="font-unbounded text-xs font-black text-grippy-cobalt tracking-tight">GRIPPY</span>
        <button onClick={handleShare} className="text-grippy-black/50 active:text-grippy-black transition-colors">
          <Share2 size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-5 px-6 pt-6 pb-safe">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            {shapeName} · {result.hand} hand · Your results
          </p>
          <h1 className="font-unbounded text-2xl font-bold text-grippy-black">
            You're a size<br />{result.size}.
          </h1>
        </motion.div>

        <ResultCard size={result.size} confidence={result.confidence} />

        {/* Per-finger breakdown */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="border border-grippy-black/10 rounded-2xl px-5 py-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40 mb-3">
            Your measurements vs size {result.size}
          </p>
          <div className="space-y-3">
            {fingerOrder.map((finger, i) => {
              const measured = result.measurements[finger];
              const target   = chartSizes[i];
              const diff     = measured !== undefined ? measured - target : null;
              const isRed    = diff !== null && Math.abs(diff) > 1.5;
              return (
                <div key={finger} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-grippy-black/60 w-14">{fingerLabels[finger]}</span>
                    <div className="flex-1 mx-3 h-1 bg-grippy-black/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-grippy-cobalt rounded-full"
                        style={{ width: measured !== undefined ? `${Math.min(100, (measured / 20) * 100)}%` : "0%" }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="font-mono text-xs text-grippy-black tabular-nums w-12">
                        {measured !== undefined ? `${measured} mm` : "—"}
                      </span>
                      {diff !== null && (
                        <span className={`font-mono text-[10px] tabular-nums w-10 ${Math.abs(diff) <= 0.5 ? "text-emerald-500" : Math.abs(diff) <= 1.5 ? "text-amber-500" : "text-rose-500"}`}>
                          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isRed && (
                    <button
                      onClick={() => handleRetake(finger)}
                      className="ml-14 font-mono text-[10px] text-rose-500 underline underline-offset-2 active:text-rose-700 transition-colors"
                    >
                      Retake {fingerLabels[finger]} →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-grippy-black/30 mt-3">
            Difference from size {result.size} target · green = within 0.5 mm
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-grippy-black/5 rounded-2xl px-5 py-4"
        >
          <p className="font-mono text-xs text-grippy-black/60 leading-relaxed">
            When between sizes, we size up — press-ons can always be filed down for a perfect fit.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col gap-3 mt-auto"
        >
          <GrippyButton
            fullWidth
            size="lg"
            onClick={() => window.open("https://grippynails.co", "_blank", "noopener,noreferrer")}
          >
            <ShoppingBag size={16} />
            Shop {shapeName} Sets
          </GrippyButton>
        </motion.div>

        <button
          onClick={() => navigate("/size")}
          className="text-center font-mono text-xs text-grippy-black/40 underline underline-offset-4 mt-2"
        >
          Take measurements again
        </button>
      </div>
    </div>
  );
}
