import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

const STEP_LABELS = ["Hand", "Shape", "Thumb", "Index", "Middle", "Ring", "Pinky"];
// seconds remaining (rough) from each step index
const TIME_SECS   = [150, 120, 90, 60, 30, 15, 5];

function timeLabel(secs: number, stepIdx: number) {
  if (stepIdx >= 6) return "Almost done!";
  if (stepIdx >= 4) return "Last stretch";
  if (secs < 60) return `~${secs}s left`;
  return `~${Math.ceil(secs / 60)} min left`;
}

export function ProgressBar({ current, total, className }: ProgressBarProps) {
  const segs    = total - 1; // 7
  const stepIdx = Math.max(0, current - 1);
  const secs    = TIME_SECS[Math.min(stepIdx, TIME_SECS.length - 1)];

  return (
    <div className={cn("w-full px-6", className)}>
      {/* Segmented dots */}
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: segs }).map((_, i) => {
          const done    = i < current - 1;
          const active  = i === current - 1;
          return (
            <motion.div
              key={i}
              layout
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-400",
                done   ? "bg-grippy-black"
                : active ? "bg-grippy-black/50"
                :          "bg-grippy-black/10",
              )}
              style={{ flex: done || active ? 2 : 1 }}
            />
          );
        })}
      </div>

      {/* Labels row */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono text-[10px] text-grippy-black/40">
          {STEP_LABELS[stepIdx] ?? ""}
          {current > 2 && (
            <span className="ml-1.5 text-grippy-black/25">
              · {current - 2} of 5
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] text-grippy-black/40">
          {timeLabel(secs, stepIdx)}
        </span>
      </div>
    </div>
  );
}
