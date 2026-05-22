import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookmarkCheck, ShoppingBag, Share2 } from "lucide-react";
import { ResultCard } from "@/components/grippy/ResultCard";
import { GrippyButton } from "@/components/grippy/Button";
import { SizeKey } from "@/lib/sizeChart";
import { MeasurementMap } from "@/hooks/use-sizing";
import { saveSizingSession } from "@/lib/grippy-supabase";

interface GrippyResult {
  size: SizeKey;
  confidence: number;
  measurements: MeasurementMap;
  hand: "left" | "right";
}

export default function Results() {
  const navigate = useNavigate();
  const [result, setResult] = useState<GrippyResult | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("grippy_result");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        navigate("/size");
      }
    } else {
      navigate("/size");
    }
  }, [navigate]);

  const handleSave = async () => {
    if (!result || saved) return;
    setSaved(true);
    await saveSizingSession(result.hand, result.size, result.confidence, result.measurements);
  };

  const handleShare = async () => {
    if (!result) return;
    const text = `My Grippy nail size is ${result.size}! Find yours at grippynails.com`;
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!result) return null;

  return (
    <div className="min-h-screen grippy-surface flex flex-col">
      {/* Nav */}
      <div className="flex items-center justify-between px-6 pt-safe pb-2 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
        <button
          onClick={() => navigate("/size")}
          className="flex items-center gap-1.5 text-grippy-black/60 font-unbounded text-xs font-semibold active:text-grippy-black transition-colors"
        >
          <ArrowLeft size={16} />
          Resize
        </button>
        <span className="font-unbounded text-xs font-black text-grippy-cobalt tracking-tight">
          GRIPPY
        </span>
        <button
          onClick={handleShare}
          className="text-grippy-black/50 active:text-grippy-black transition-colors"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-6 px-5 pt-4 pb-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            {result.hand} hand · Your results
          </p>
          <h1 className="font-unbounded text-2xl font-bold text-grippy-black">
            You're a size<br />
            <span className="text-grippy-cobalt">{result.size}.</span>
          </h1>
        </motion.div>

        {/* Result card */}
        <ResultCard
          size={result.size}
          confidence={result.confidence}
          measurements={result.measurements}
        />

        {/* Sizing notes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-grippy-black/5 rounded-2xl px-5 py-4"
        >
          <p className="font-mono text-xs text-grippy-black/60 leading-relaxed">
            Sizes are based on nail width measurements. If you're between sizes, we recommend sizing up for a comfortable fit. All Grippy sets include a nail file for customisation.
          </p>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col gap-3 mt-auto"
        >
          <GrippyButton
            fullWidth
            size="lg"
            variant={saved ? "outline" : "primary"}
            onClick={handleSave}
          >
            {saved ? (
              <>
                <BookmarkCheck size={16} />
                Size Saved
              </>
            ) : (
              <>
                <BookmarkCheck size={16} />
                Save My Size
              </>
            )}
          </GrippyButton>

          <GrippyButton fullWidth size="lg" variant="ghost">
            <ShoppingBag size={16} />
            Shop Sets
          </GrippyButton>
        </motion.div>

        {/* Retake */}
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
