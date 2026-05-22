import { supabase } from "@/integrations/supabase/client";
import { SizeKey } from "./sizeChart";
import { MeasurementMap } from "@/hooks/use-sizing";

export async function saveSizingSession(
  hand: "left" | "right",
  size: SizeKey,
  confidence: number,
  measurements: MeasurementMap
): Promise<{ sessionId: string | null; error: string | null }> {
  // Create anonymous profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .insert({})
    .select("id")
    .single();

  if (profileErr || !profile) {
    return { sessionId: null, error: profileErr?.message ?? "Failed to create profile" };
  }

  // Create session
  const { data: session, error: sessionErr } = await supabase
    .from("sizing_sessions")
    .insert({ profile_id: profile.id, hand, recommended_size: size, confidence })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return { sessionId: null, error: sessionErr?.message ?? "Failed to save session" };
  }

  // Save measurements
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

export async function fetchSession(sessionId: string) {
  const { data: session } = await supabase
    .from("sizing_sessions")
    .select("*, measurements(*)")
    .eq("id", sessionId)
    .single();
  return session;
}
