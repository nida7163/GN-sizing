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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBase64 },
          },
          {
            type: "text",
            text: `Analyze this close-up photo of a human finger with a ${referenceObject} placed next to it on a flat surface, photographed from above.

Find two things and express their positions as fractions of image dimensions (0.0 = left/top edge, 1.0 = right/bottom edge):

1. THE ${referenceObject.toUpperCase()}: its leftmost and rightmost visible outer edges
2. THE FINGERNAIL: left and right edges at the widest visible point of the nail bed, plus the vertical center (y) of that measurement line

Return ONLY this JSON (no explanation, no markdown):
{"ref_left":0.00,"ref_right":0.00,"nail_left":0.00,"nail_right":0.00,"nail_y":0.50}`,
          },
        ],
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const match = text.match(/\{[^}]+\}/);
    if (!match) throw new Error("No JSON in response");
    const coords = JSON.parse(match[0]);

    // Validate all required keys
    const keys = ["ref_left", "ref_right", "nail_left", "nail_right", "nail_y"];
    for (const k of keys) {
      if (typeof coords[k] !== "number") throw new Error(`Missing field: ${k}`);
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
