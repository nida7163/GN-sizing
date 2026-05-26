import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { imageBase64, mimeType, referenceObject } = await req.json();

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBase64 },
          },
          {
            type: "text",
            text: `You are a precision measurement assistant. This is a top-down photo of a single human finger with a ${referenceObject} placed flat on the surface next to it. Both are intended for size measurement.

CRITICAL CONTEXT:
- The image coordinate system: x=0.0 is the LEFT edge of the image, x=1.0 is the RIGHT edge. y=0.0 is TOP, y=1.0 is BOTTOM.
- The ${referenceObject} and the fingernail will be at DIFFERENT horizontal positions in the image (one is to the left of the other). They should NOT overlap.
- Be extremely precise. Use the entire decimal range — values like 0.237 or 0.812 are normal, not just round numbers like 0.5.

STEP 1: Describe what you see in 1–2 sentences. Where is the ${referenceObject} relative to the finger? (e.g., "card is on the left, finger on the right")

STEP 2: Locate the ${referenceObject.toUpperCase()}. Carefully study its leftmost and rightmost outer edges. Give exact x-coordinate fractions of the total image width.
- ref_left  = x-fraction of the LEFTMOST visible edge of the ${referenceObject}
- ref_right = x-fraction of the RIGHTMOST visible edge of the ${referenceObject}

STEP 3: Locate the FINGERNAIL (the pink/white nail plate, NOT the surrounding finger flesh). Find its widest point near the base of the nail (cuticle area), where it appears flattest from above.
- nail_left  = x-fraction of the LEFT edge of the nail PLATE at its widest visible point
- nail_right = x-fraction of the RIGHT edge of the nail PLATE at the same widest point
- nail_y     = y-fraction of the vertical center of that measurement line

SANITY CHECK:
- ref_left  must be < ref_right
- nail_left must be < nail_right
- The reference object range [ref_left, ref_right] and nail range [nail_left, nail_right] should NOT significantly overlap — they're in different parts of the image.
- A typical fingernail is roughly 30–70% of a credit card's width, or 50–90% of a quarter's width.

After your reasoning, output the final JSON on a SINGLE line at the very end, in this exact format:
FINAL: {"ref_left":0.000,"ref_right":0.000,"nail_left":0.000,"nail_right":0.000,"nail_y":0.500}`,
          },
        ],
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract the FINAL: line, fallback to any JSON object in the response
    const finalMatch = text.match(/FINAL:\s*(\{[^}]+\})/i);
    const anyMatch   = text.match(/\{[^}]+\}/);
    const jsonStr    = finalMatch?.[1] ?? anyMatch?.[0];
    if (!jsonStr) throw new Error("No JSON in model response");

    const coords = JSON.parse(jsonStr);

    // Validate all required keys exist and are numbers
    const keys = ["ref_left", "ref_right", "nail_left", "nail_right", "nail_y"];
    for (const k of keys) {
      if (typeof coords[k] !== "number") throw new Error(`Missing field: ${k}`);
      if (coords[k] < 0 || coords[k] > 1)  throw new Error(`Out of range: ${k}=${coords[k]}`);
    }

    // Sanity checks
    if (coords.ref_left  >= coords.ref_right)  throw new Error("Reference: left >= right");
    if (coords.nail_left >= coords.nail_right) throw new Error("Nail: left >= right");

    const refWidth  = coords.ref_right  - coords.ref_left;
    const nailWidth = coords.nail_right - coords.nail_left;
    if (refWidth  < 0.02) throw new Error("Reference width too small (likely misdetection)");
    if (nailWidth < 0.01) throw new Error("Nail width too small (likely misdetection)");

    // Check for overlap: if the nail range is entirely inside the ref range
    // or vice versa, that's a sign the model confused them.
    const overlap = Math.max(0, Math.min(coords.ref_right, coords.nail_right) - Math.max(coords.ref_left, coords.nail_left));
    const smallerWidth = Math.min(refWidth, nailWidth);
    if (overlap > smallerWidth * 0.8) {
      throw new Error(`Reference and nail overlap too much (likely AI confusion): overlap=${overlap.toFixed(3)}`);
    }

    return new Response(JSON.stringify(coords), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
