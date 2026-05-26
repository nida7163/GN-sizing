import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag, Share2 } from "lucide-react";
import { ResultCard } from "@/components/grippy/ResultCard";
import { GrippyButton } from "@/components/grippy/Button";
import { AuthModal } from "@/components/grippy/AuthModal";
import { SizeKey, NailShape, shapeLabels, fingerOrder, fingerLabels, sizeCharts } from "@/lib/sizeChart";
import type { FingerName } from "@/lib/sizeChart";
import type { MeasurementMap } from "@/hooks/use-sizing";
import { saveSizingSession } from "@/lib/grippy-supabase";
import { supabaseConfigured } from "@/integrations/supabase/client";

interface GrippyResult {
  size: SizeKey;
  confidence: number;
  sizedUp?: boolean;
  originalSize?: SizeKey;
  isGiftMode?: boolean;
  isSharedView?: boolean;
  measurements: MeasurementMap;
  hand: "left" | "right";
  shape: NailShape;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Results() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [result,     setResult]     = useState<GrippyResult | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [showAuth,   setShowAuth]   = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    // 1. URL params → gifter opening a shared link
    const paramSize       = searchParams.get("size") as SizeKey | null;
    const paramShape      = searchParams.get("shape") as NailShape | null;
    const paramHand       = searchParams.get("hand") as "left" | "right" | null;
    const paramConfidence = searchParams.get("confidence");
    const paramM          = searchParams.get("m");
    const paramSizedUp    = searchParams.get("sizedUp") === "1";
    const paramOriginal   = searchParams.get("originalSize") as SizeKey | null;

    const VALID_SHAPES: NailShape[] = ["short-round", "short-oval"];
    const VALID_SIZES:  SizeKey[]   = ["XS", "S", "M", "L"];

    if (paramSize && paramShape && paramHand) {
      if (!VALID_SHAPES.includes(paramShape) || !VALID_SIZES.includes(paramSize)) {
        navigate("/size");
        return;
      }
      const measurements: MeasurementMap = {};
      if (paramM) {
        paramM.split(",").forEach((val, i) => {
          const f = fingerOrder[i];
          if (f) measurements[f] = parseFloat(val);
        });
      }
      setResult({
        size:         paramSize,
        shape:        paramShape,
        hand:         paramHand,
        confidence:   paramConfidence ? parseInt(paramConfidence) : 70,
        measurements,
        sizedUp:      paramSizedUp || undefined,
        originalSize: paramOriginal ?? undefined,
        isSharedView: true,
      });
      return;
    }

    // 2. sessionStorage → recipient just finished measuring
    const raw = sessionStorage.getItem("grippy_result");
    if (raw) {
      try { setResult(JSON.parse(raw)); }
      catch { navigate("/size"); }
    } else {
      navigate("/size");
    }
  }, [navigate, searchParams]);

  // Auto-save to Supabase when a real result loads (only if Supabase is configured)
  useEffect(() => {
    if (!result || result.isSharedView || savedRef.current || !supabaseConfigured) return;
    savedRef.current = true;
    setSaveStatus("saving");
    saveSizingSession(result.hand, result.size, result.confidence, result.measurements, result.shape)
      .then(({ error }) => setSaveStatus(error ? "error" : "saved"));
  }, [result]);

  const handleRetake = (finger: FingerName) => {
    if (!result) return;
    const fingerIdx    = fingerOrder.indexOf(finger);
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

    if (result.isGiftMode) {
      // Build a URL with all results encoded so the gifter sees a real results page
      const params = new URLSearchParams({
        size:       result.size,
        shape:      result.shape,
        hand:       result.hand,
        confidence: String(result.confidence),
      });
      if (result.sizedUp)    params.set("sizedUp",      "1");
      if (result.originalSize) params.set("originalSize", result.originalSize);
      const mArr = fingerOrder.map(f => (result.measurements[f] ?? 0).toFixed(1));
      params.set("m", mArr.join(","));

      const url  = `${window.location.origin}/results?${params.toString()}`;
      const text = `Here are my nail measurements for your Grippy Fit gift!`;

      if (navigator.share) {
        try { await navigator.share({ title: "My Grippy Fit Size", text, url }); }
        catch { /* dismissed */ }
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      // Normal share — plain text
      const text = `My Grippy Fit nail size is ${result.size} in ${shapeName}! Find yours at grippynails.co`;
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleCopyLink = async () => {
    if (!result) return;
    const params = new URLSearchParams({
      size:       result.size,
      shape:      result.shape,
      hand:       result.hand,
      confidence: String(result.confidence),
    });
    if (result.sizedUp)      params.set("sizedUp",      "1");
    if (result.originalSize) params.set("originalSize", result.originalSize);
    const mArr = fingerOrder.map(f => (result.measurements[f] ?? 0).toFixed(1));
    params.set("m", mArr.join(","));
    await navigator.clipboard.writeText(`${window.location.origin}/results?${params.toString()}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) return null;

  const shapeName  = shapeLabels[result.shape] ?? result.shape;
  const chartSizes = sizeCharts[result.shape]?.[result.size] ?? [];
  const hasMeasurements = fingerOrder.some(f => result.measurements[f] !== undefined);

  // ── Shared view (gifter opening a gift link) ──────────────────────────────
  if (result.isSharedView) {
    return (
      <div className="min-h-screen grippy-surface flex flex-col">
        <div className="flex items-center justify-between px-6 pt-safe pb-4 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
          <span className="font-unbounded text-xs font-black text-grippy-cobalt tracking-tight">GRIPPY FIT</span>
          <button
            onClick={handleCopyLink}
            className="font-mono text-[10px] text-grippy-black/40 active:text-grippy-black/60 transition-colors"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-5 px-6 pt-6 pb-safe">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="space-y-1"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
              {shapeName} · {result.hand} hand · Gift size
            </p>
            <h1 className="font-unbounded text-2xl font-bold text-grippy-black">
              They're a size<br />{result.size}.
            </h1>
          </motion.div>

          <ResultCard size={result.size} confidence={result.confidence} />

          {result.sizedUp && result.originalSize && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="flex items-start gap-3 bg-grippy-black text-grippy-cream rounded-2xl px-5 py-4"
            >
              <span className="text-base mt-0.5 shrink-0">↑</span>
              <div className="space-y-1">
                <p className="font-unbounded text-xs font-bold text-grippy-cream">
                  Between {result.originalSize} and {result.size}
                </p>
                <p className="font-mono text-[11px] text-grippy-cream/70 leading-relaxed">
                  Sized up — press-ons can always be filed down for a perfect fit.
                </p>
              </div>
            </motion.div>
          )}

          {hasMeasurements && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="border border-grippy-black/10 rounded-2xl px-5 py-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40 mb-3">
                Their measurements vs size {result.size}
              </p>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-grippy-black/10">
                <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-14">Finger</span>
                <span className="flex-1 mx-3 font-mono text-[9px] uppercase tracking-wider text-grippy-black/40">Relative width</span>
                <div className="flex items-center gap-2 text-right">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-12">Measured</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-10">vs {result.size}</span>
                </div>
              </div>
              <div className="space-y-3">
                {fingerOrder.map((finger, i) => {
                  const measured = result.measurements[finger];
                  const target   = chartSizes[i];
                  const diff     = measured !== undefined ? measured - target : null;
                  return (
                    <div key={finger} className="flex items-center justify-between">
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
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-grippy-black/10 space-y-1">
                <p className="font-mono text-[10px] text-grippy-black/50">
                  <span className="text-grippy-black/70">Measured</span> = their actual nail width in millimeters
                </p>
                <p className="font-mono text-[10px] text-grippy-black/50">
                  <span className="text-grippy-black/70">vs {result.size}</span> = difference from the size {result.size} target ·{" "}
                  <span className="text-emerald-500">green</span> within 0.5 mm ·{" "}
                  <span className="text-amber-500">amber</span> within 1.5 mm ·{" "}
                  <span className="text-rose-500">red</span> off by more
                </p>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col gap-3 mt-auto"
          >
            <GrippyButton
              fullWidth size="lg"
              onClick={() => window.open(`https://grippynails.co`, "_blank", "noopener,noreferrer")}
            >
              <ShoppingBag size={16} />
              Shop Size {result.size} {shapeName} Sets
            </GrippyButton>
            <button
              onClick={() => navigate("/size")}
              className="text-center font-mono text-xs text-grippy-black/40 underline underline-offset-4"
            >
              Size yourself →
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Normal / gift-recipient view ──────────────────────────────────────────
  return (
    <div className="min-h-screen grippy-surface flex flex-col">
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />

      {/* Nav */}
      <div className="flex items-center justify-between px-6 pt-safe pb-4 sticky top-0 z-10 bg-grippy-cream/80 backdrop-blur-sm">
        <button
          onClick={() => navigate("/size")}
          className="flex items-center gap-1.5 text-grippy-black/60 font-unbounded text-xs font-semibold active:text-grippy-black transition-colors"
        >
          <ArrowLeft size={16} />
          Resize
        </button>
        <span className="font-unbounded text-xs font-black text-grippy-cobalt tracking-tight">GRIPPY FIT</span>
        <div className="flex items-center gap-3">
          {saveStatus === "saving" && (
            <span className="font-mono text-[10px] text-grippy-black/30">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="font-mono text-[10px] text-emerald-500">Saved ✓</span>
          )}
          {saveStatus === "error" && (
            <span className="font-mono text-[10px] text-rose-400">Save failed</span>
          )}
          <button
            onClick={handleShare}
            className="text-grippy-black/50 active:text-grippy-black transition-colors"
            title={copied ? "Copied!" : undefined}
          >
            {copied ? (
              <span className="font-mono text-[10px] text-grippy-black/50">Copied!</span>
            ) : (
              <Share2 size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-5 px-6 pt-6 pb-safe">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            {shapeName} · {result.hand} hand · {result.isGiftMode ? "Ready to share" : "Your results"}
          </p>
          <h1 className="font-unbounded text-2xl font-bold text-grippy-black">
            {result.isGiftMode ? "Share this with" : "You're a size"}<br />
            {result.isGiftMode ? "your gifter." : `${result.size}.`}
          </h1>
        </motion.div>

        <ResultCard size={result.size} confidence={result.confidence} />

        {/* Confidence nudge */}
        {result.sizedUp && result.originalSize && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="flex items-start gap-3 bg-grippy-black text-grippy-cream rounded-2xl px-5 py-4"
          >
            <span className="text-base mt-0.5 shrink-0">↑</span>
            <div className="space-y-1">
              <p className="font-unbounded text-xs font-bold text-grippy-cream">
                You're between {result.originalSize} and {result.size}
              </p>
              <p className="font-mono text-[11px] text-grippy-cream/70 leading-relaxed">
                We sized you up — press-ons can always be filed down for a perfect fit, but they can't be enlarged.
              </p>
            </div>
          </motion.div>
        )}

        {/* Per-finger breakdown */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="border border-grippy-black/10 rounded-2xl px-5 py-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40 mb-3">
            Your measurements vs size {result.size}
          </p>
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-grippy-black/10">
            <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-14">Finger</span>
            <span className="flex-1 mx-3 font-mono text-[9px] uppercase tracking-wider text-grippy-black/40">Relative width</span>
            <div className="flex items-center gap-2 text-right">
              <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-12">Measured</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-grippy-black/40 w-10">vs {result.size}</span>
            </div>
          </div>
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
                  {isRed && !result.isGiftMode && (
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
          <div className="mt-3 pt-3 border-t border-grippy-black/10 space-y-1">
            <p className="font-mono text-[10px] text-grippy-black/50">
              <span className="text-grippy-black/70">Measured</span> = your actual nail width in millimeters
            </p>
            <p className="font-mono text-[10px] text-grippy-black/50">
              <span className="text-grippy-black/70">vs {result.size}</span> = difference from the size {result.size} target ·{" "}
              <span className="text-emerald-500">green</span> within 0.5 mm ·{" "}
              <span className="text-amber-500">amber</span> within 1.5 mm ·{" "}
              <span className="text-rose-500">red</span> off by more
            </p>
          </div>
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
          {result.isGiftMode ? (
            <>
              <GrippyButton fullWidth size="lg" onClick={handleShare}>
                <Share2 size={16} />
                {copied ? "Link copied!" : "Share my size"}
              </GrippyButton>
              <button
                onClick={() => window.open("https://grippynails.co", "_blank", "noopener,noreferrer")}
                className="flex items-center justify-center gap-2 font-mono text-xs text-grippy-black/50 underline underline-offset-4 active:text-grippy-black/80 transition-colors"
              >
                <ShoppingBag size={13} />
                Shop {shapeName} Sets
              </button>
            </>
          ) : (
            <GrippyButton
              fullWidth size="lg"
              onClick={() => window.open("https://grippynails.co", "_blank", "noopener,noreferrer")}
            >
              <ShoppingBag size={16} />
              Shop {shapeName} Sets
            </GrippyButton>
          )}
        </motion.div>

        <button
          onClick={() => setShowAuth(true)}
          className="text-center font-mono text-xs text-grippy-black/50 active:text-grippy-black/80 transition-colors mt-1"
        >
          Email me my size →
        </button>

        <button
          onClick={() => navigate("/size")}
          className="text-center font-mono text-xs text-grippy-black/40 underline underline-offset-4 mt-1"
        >
          Take measurements again
        </button>
      </div>
    </div>
  );
}
