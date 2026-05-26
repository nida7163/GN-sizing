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
      model: "claude-sonnet-4-6",
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
            text: `You are measuring a fingernail width from a top-down photo. The photo shows a single finger lying flat with a ${referenceObject} placed beside it as a size reference.

Express all positions as fractions of the TOTAL IMAGE WIDTH or HEIGHT (0.0 = left/top edge, 1.0 = right/bottom edge). Be as precise as possible.

Locate these two things:

1. THE ${referenceObject.toUpperCase()} — find its leftmost outer edge (ref_left) and rightmost outer edge (ref_right) as fractions of image width.

2. THE FINGERNAIL — find the left edge (nail_left) and right edge (nail_right) of the nail bed at its WIDEST visible point, as fractions of image width. Also give the vertical center of that measurement line as a fraction of image height (nail_y).

Return ONLY valid JSON, no explanation:
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
