import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;

    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!resolved) { resolved = true; setLoading(false); }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved) { resolved = true; setUser(session?.user ?? null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string) => {
    if (!supabaseConfigured || !supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/results" },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  return { user, loading, sendMagicLink, signOut };
}
