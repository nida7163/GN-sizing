import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires first on init (including PKCE code exchange on magic link
    // callback pages). We use it as the authoritative signal for when auth is ready.
    // getSession() is a fast path for pages where no code exchange is needed.
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    });

    // Fallback: if onAuthStateChange doesn't fire quickly (no URL code, already-stored
    // session), getSession() resolves the loading state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved) {
        resolved = true;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/results" },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, sendMagicLink, signOut };
}
