import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, CheckCircle } from "lucide-react";
import { GrippyButton } from "@/components/grippy/Button";
import { useAuth } from "@/hooks/use-auth";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await sendMagicLink(email.trim());
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-grippy-black/40 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-5 text-grippy-black/30 active:text-grippy-black transition-colors"
            >
              <X size={20} />
            </button>

            {!sent ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="space-y-1.5">
                  <h2 className="font-unbounded text-xl font-bold text-grippy-black">Save your size</h2>
                  <p className="font-mono text-sm text-grippy-black/50">
                    Enter your email — we'll send a magic link. No password needed.
                  </p>
                </div>

                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-grippy-black/30 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-grippy-black/10 bg-grippy-black/5 font-mono text-sm text-grippy-black placeholder:text-grippy-black/30 focus:outline-none focus:border-grippy-black/30 transition-colors"
                  />
                </div>

                {error && (
                  <p className="font-mono text-xs text-red-500 -mt-2">{error}</p>
                )}

                <GrippyButton type="submit" fullWidth size="lg" disabled={loading}>
                  {loading ? "Sending…" : "Send Magic Link"}
                </GrippyButton>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
                <CheckCircle size={40} className="text-grippy-black" />
                <div className="space-y-2">
                  <h2 className="font-unbounded text-xl font-bold text-grippy-black">Check your email</h2>
                  <p className="font-mono text-sm text-grippy-black/50">
                    We sent a link to<br />
                    <span className="text-grippy-black">{email}</span>
                  </p>
                  <p className="font-mono text-[10px] text-grippy-black/30 uppercase tracking-widest">
                    Check spam if you don't see it
                  </p>
                </div>
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="font-mono text-xs text-grippy-black/40 underline underline-offset-4 mt-1"
                >
                  Try a different email
                </button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
