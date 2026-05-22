import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SizeKey, fingerOrder, fingerLabels } from "@/lib/sizeChart";
import { MeasurementMap } from "@/hooks/use-sizing";
import { cn } from "@/lib/utils";

interface ResultCardProps {
  size: SizeKey;
  confidence: number;
  measurements: MeasurementMap;
  className?: string;
}

const confidenceLabel = (n: number) =>
  n >= 85 ? "Excellent match" : n >= 70 ? "Great match" : n >= 50 ? "Good match" : "Approximate match";

const confidenceColor = (n: number) =>
  n >= 85 ? "text-emerald-600" : n >= 70 ? "text-blue-600" : n >= 50 ? "text-amber-600" : "text-rose-500";

export function ResultCard({ size, confidence, measurements, className }: ResultCardProps) {
  return (
    <motion.div
      className={cn("w-full rounded-3xl bg-grippy-black text-grippy-cream overflow-hidden", className)}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Size hero */}
      <div className="flex flex-col items-center justify-center py-12 px-6 border-b border-white/10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 16 }}
          className="flex items-center justify-center w-24 h-24 rounded-full bg-grippy-cobalt mb-4"
        >
          <span className="font-unbounded text-4xl font-bold text-grippy-cream">{size}</span>
        </motion.div>
        <p className="font-unbounded text-sm text-grippy-cream/60 mb-1">Your Grippy Size</p>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className={confidenceColor(confidence)} />
          <span className={cn("font-mono text-xs", confidenceColor(confidence))}>
            {confidenceLabel(confidence)} — {confidence}%
          </span>
        </div>
      </div>

      {/* Individual widths */}
      <div className="px-6 py-6 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-cream/40 mb-4">Nail Widths (mm)</p>
        {fingerOrder.map((finger, i) => {
          const width = measurements[finger];
          return (
            <motion.div
              key={finger}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className="flex items-center justify-between"
            >
              <span className="font-unbounded text-xs text-grippy-cream/70">{fingerLabels[finger]}</span>
              <span className="font-mono text-sm font-medium text-grippy-cream">
                {width !== undefined ? `${width} mm` : "—"}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
