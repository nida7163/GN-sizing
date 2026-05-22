import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookmarkCheck, ShoppingBag, Share2, History, LogOut } from "lucide-react";
import { ResultCard } from "@/components/grippy/ResultCard";
import { GrippyButton } from "@/components/grippy/Button";
import { AuthModal } from "@/components/grippy/AuthModal";
import { SizeKey, NailShape, shapeLabels } from "@/lib/sizeChart";
import { MeasurementMap } from "@/hooks/use-sizing";
import { useAuth } from "@/hooks/use-auth";
import { saveSizingSession, fetchHistory, HistorySession } from "@/lib/grippy-supabase";

interface GrippyResult {
  size: SizeKey;
  confidence: number;
  measurements: MeasurementMap;
  hand: "left" | "right";
  shape: NailShape;
}

export default function Results() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [result, setResult] = useState<GrippyResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [history, setHistory] = useState<HistorySession[]>([]);

  // Detect if we landed here from a magic link (URL has ?code= from Supabase PKCE exchange)
  const [isAuthCallback] = useState(() =>
    new URLSearchParams(window.location.search).has("code")
  );

  // Load result — check sessionStorage first, then localStorage (for post-magic-link redirect)
  useEffect(() => {
    const raw = sessionStorage.getItem("grippy_result") || localStorage.getItem("grippy_pending_save");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        navigate("/size");
      }
    } else if (!isAuthCallback) {
      // Only redirect immediately if this isn't a magic link callback.
      // On auth callback, we wait for auth to resolve — the user may need
      // to be logged in before we know what to show.
      navigate("/size");
    }
  }, [navigate, isAuthCallback]);

  // On magic link callback: once auth resolves and there's still no result data, give up
  useEffect(() => {
    if (isAuthCallback && !result && !authLoading && !user) {
      navigate("/size");
    }
  }, [isAuthCallback, result, authLoading, user, navigate]);

  // After magic link login: auto-save the pending result
  useEffect(() => {
    if (!user || authLoading || saved) return;
    const pending = localStorage.getItem("grippy_pending_save");
    if (pending) {
      try {
        const pendingResult: GrippyResult = JSON.parse(pending);
        localStorage.removeItem("grippy_pending_save");
        setSaved(true);
        saveSizingSession(
          pendingResult.hand,
          pendingResult.size,
          pendingResult.confidence,
          pendingResult.measurements,
          pendingResult.shape,
          user.id
        );
      } catch {}
    }
  }, [user, authLoading, saved]);

  // Load history when logged in or after saving
  useEffect(() => {
    if (!user) { setHistory([]); return; }
    fetchHistory(user.id).then(setHistory);
  }, [user, saved]);

  const handleSave = async () => {
    if (!result || saved) return;
    if (!user) {
      localStorage.setItem("grippy_pending_save", JSON.stringify(result));
      setShowAuthModal(true);
      return;
    }
    setSaved(true);
    await saveSizingSession(result.hand, result.size, result.confidence, result.measurements, result.shape, user.id);
  };

  const handleShare = async () => {
    if (!result) return;
    const shapeName = shapeLabels[result.shape] ?? result.shape;
    const text = `My Grippy nail size is ${result.size} in ${shapeName}! Find yours at grippynails.com`;
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!result) {
    if (isAuthCallback && authLoading) {
      return (
        <div className="min-h-screen grippy-surface flex items-center justify-center">
          <span className="font-unbounded text-xs text-grippy-black/40 tracking-widest">Signing you in…</span>
        </div>
      );
    }
    return null;
  }

  const shapeName = shapeLabels[result.shape] ?? result.shape;

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
      <div className="flex-1 flex flex-col gap-5 px-5 pt-4 pb-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-1"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-grippy-black/40">
            {shapeName} · {result.hand} hand · Your results
          </p>
          <h1 className="font-unbounded text-2xl font-bold text-grippy-black">
            You're a size<br />{result.size}.
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
          transition={{ delay: 0.4 }}
          className="bg-grippy-black/5 rounded-2xl px-5 py-4"
        >
          <p className="font-mono text-xs text-grippy-black/60 leading-relaxed">
            Sizes are based on nail width measurements. If you're between sizes, we recommend sizing up for a comfortable fit. All Grippy sets include a nail file for customisation.
          </p>
        </motion.div>

        {/* Sizing history */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="border border-grippy-black/10 rounded-2xl px-5 py-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={15} className="text-grippy-black/40" />
              <p className="font-unbounded text-xs font-semibold text-grippy-black">Sizing History</p>
            </div>
            {user && (
              <button
                onClick={signOut}
                className="flex items-center gap-1 font-mono text-[10px] text-grippy-black/40 active:text-grippy-black transition-colors"
              >
                <LogOut size={11} />
                Sign out
              </button>
            )}
          </div>

          {!user ? (
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs text-grippy-black/40">
                Save your size to see history here.
              </p>
              <span className="font-mono text-[9px] uppercase tracking-widest bg-grippy-black/5 text-grippy-black/40 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                Sign in to unlock
              </span>
            </div>
          ) : history.length === 0 ? (
            <p className="font-mono text-xs text-grippy-black/40">
              Your saved sizes will appear here.
            </p>
          ) : (
            <div className="space-y-0">
              {history.map((session, i) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between py-3 ${i < history.length - 1 ? "border-b border-grippy-black/5" : ""}`}
                >
                  <div>
                    <p className="font-unbounded text-xs font-semibold text-grippy-black">
                      Size {session.recommended_size}
                      {session.shape ? ` · ${shapeLabels[session.shape as NailShape] ?? session.shape}` : ""}
                      {" · "}{session.hand} hand
                    </p>
                    <p className="font-mono text-[10px] text-grippy-black/40 mt-0.5">
                      {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <GrippyButton variant="ghost" size="sm">
                    Reorder
                  </GrippyButton>
                </div>
              ))}
            </div>
          )}
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
            <BookmarkCheck size={16} />
            {saved ? "Size Saved" : "Save My Size"}
          </GrippyButton>

          <GrippyButton fullWidth size="lg" variant="ghost">
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

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
