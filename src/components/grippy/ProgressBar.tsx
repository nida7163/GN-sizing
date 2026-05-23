import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

const STEP_LABELS = ["", "Hand", "Shape", "Thumb", "Index", "Middle", "Ring", "Pinky"];

export function ProgressBar({ current, total, className }: ProgressBarProps) {
  const percent = Math.min(100, Math.round((current / (total - 1)) * 100));

  return (
    <div className={cn("w-full px-6 pt-safe", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-grippy-black/40 uppercase tracking-widest">
          {STEP_LABELS[current] ?? ""}
        </span>
        <span className="font-mono text-[10px] text-grippy-black/40">
          {current}/{total - 1}
        </span>
      </div>
      <div className="h-[2px] w-full bg-grippy-black/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-grippy-cobalt rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
