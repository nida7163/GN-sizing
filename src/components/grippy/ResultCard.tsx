import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SizeKey } from "@/lib/sizeChart";
import { cn } from "@/lib/utils";

interface ResultCardProps {
  size: SizeKey;
  confidence: number;
  className?: string;
}

const confidenceLabel = (n: number) =>
  n >= 85 ? "Excellent match" : n >= 70 ? "Great match" : n >= 50 ? "Good match" : "Approximate match";

const confidenceColor = (n: number) =>
  n >= 85 ? "text-emerald-500" : n >= 70 ? "text-blue-500" : n >= 50 ? "text-amber-500" : "text-rose-500";

const confidenceBg = (n: number) =>
  n >= 85 ? "bg-emerald-500" : n >= 70 ? "bg-blue-500" : n >= 50 ? "bg-amber-500" : "bg-rose-500";

export function ResultCard({ size, confidence, className }: ResultCardProps) {
  return (
    <motion.div
      className={cn("w-full rounded-3xl bg-grippy-black text-grippy-cream overflow-hidden", className)}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center justify-center py-14 px-6 gap-5">
        {/* Size badge */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 16 }}
          className="flex items-center justify-center w-28 h-28 rounded-full bg-grippy-cobalt shadow-lg"
        >
          <span className="font-unbounded text-5xl font-bold text-grippy-cream">{size}</span>
        </motion.div>

        <div className="text-center space-y-1">
          <p className="font-unbounded text-base text-grippy-cream/70">Your Grippy Size</p>
        </div>

        {/* Match percentage */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col items-center gap-3 w-full max-w-[200px]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className={confidenceColor(confidence)} />
            <span className={cn("font-mono text-sm font-medium", confidenceColor(confidence))}>
              {confidenceLabel(confidence)}
            </span>
          </div>

          {/* Match bar */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", confidenceBg(confidence))}
              initial={{ width: 0 }}
              animate={{ width: `${confidence}%` }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
            />
          </div>

          <p className="font-mono text-3xl font-bold text-grippy-cream tabular-nums">
            {confidence}%
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
