import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { SizeKey, NailShape } from "./sizeChart";
import { MeasurementMap } from "@/hooks/use-sizing";

export async function saveSizingSession(
  hand: "left" | "right",
  size: SizeKey,
  confidence: number,
  measurements: MeasurementMap,
  shape?: NailShape,
  userId?: string
): Promise<{ sessionId: string | null; error: string | null }> {
  if (!supabaseConfigured || !supabase) {
    return { sessionId: null, error: "Supabase not configured" };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .insert({ user_id: userId ?? null })
    .select("id")
    .single();

  if (profileErr || !profile) {
    return { sessionId: null, error: profileErr?.message ?? "Failed to create profile" };
  }

  const { data: session, error: sessionErr } = await supabase
    .from("sizing_sessions")
    .insert({
      profile_id: profile.id,
      hand,
      recommended_size: size,
      confidence,
      shape: shape ?? null,
      user_id: userId ?? null,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return { sessionId: null, error: sessionErr?.message ?? "Failed to save session" };
  }

  const { error: measErr } = await supabase.from("measurements").insert({
    session_id: session.id,
    thumb: measurements.thumb ?? null,
    index_finger: measurements.index ?? null,
    middle_finger: measurements.middle ?? null,
    ring_finger: measurements.ring ?? null,
    pinky: measurements.pinky ?? null,
  });

  if (measErr) {
    return { sessionId: session.id, error: measErr.message };
  }

  return { sessionId: session.id, error: null };
}

export interface HistorySession {
  id: string;
  created_at: string;
  recommended_size: string;
  shape: string | null;
  hand: string;
}

export async function fetchHistory(userId: string): Promise<HistorySession[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from("sizing_sessions")
    .select("id, created_at, recommended_size, shape, hand")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export async function fetchSession(sessionId: string) {
  if (!supabaseConfigured || !supabase) return null;
  const { data: session } = await supabase
    .from("sizing_sessions")
    .select("*, measurements(*)")
    .eq("id", sessionId)
    .single();
  return session;
}
