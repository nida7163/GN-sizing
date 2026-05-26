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
            text: `You are a precision measurement assistant. This is a top-down photo of a single human finger with a ${referenceObject} placed flat on a surface nearby. The goal is to measure the fingernail width using the ${referenceObject} as a size reference.

COORDINATE SYSTEM: x=0.0 is the LEFT edge of the image, x=1.0 is the RIGHT edge. y=0.0 is TOP, y=1.0 is BOTTOM.

STEP 1: Describe exactly what you see. Where is the ${referenceObject} in the image (top half? bottom half? left side? right side?)? Where is the finger?

STEP 2: Locate the physical edges of the ${referenceObject.toUpperCase()}.
The ${referenceObject} does NOT fill the entire image — there is background/surface visible around it.
Find the exact physical edges of the ${referenceObject} itself (not the image boundary, not shadows, not reflections).
- ref_left  = x-fraction where the ${referenceObject}'s LEFT physical edge is (this will NOT be 0.0 unless the card truly touches the left image border)
- ref_right = x-fraction where the ${referenceObject}'s RIGHT physical edge is
- ref_y     = y-fraction of the vertical CENTER of the ${referenceObject}

STEP 3: Locate the LEFT and RIGHT SIDE EDGES of the fingernail plate.
The nail plate is a hard, smooth oval at the fingertip. It often has a shiny white highlight in the CENTER — DO NOT use this highlight as a reference point.
Instead, find the SIDE BOUNDARIES: where the hard nail surface ends and the soft skin begins on each side of the finger.
- nail_left  = x-fraction of the LEFT SIDE where nail plate meets skin (left boundary of the nail plate)
- nail_right = x-fraction of the RIGHT SIDE where nail plate meets skin (right boundary of the nail plate)
- nail_y     = y-fraction of the widest horizontal cross-section (near the cuticle/base of the nail)

Width sanity check: nail_right - nail_left should be about 15–23% of (ref_right - ref_left) for a thumb, or 10–18% for index/middle/ring/pinky. If your value is outside this range, look again.

SANITY CHECK before finalizing:
- ref_left must be < ref_right (and ref_left should be well above 0.05 unless card truly touches left border)
- nail_left must be < nail_right
- A credit card is 86mm wide. A typical thumbnail is 15–20mm wide, an index/middle nail is 10–14mm. So the nail width should be roughly 15–25% of a credit card's pixel width.

After your reasoning, output on ONE line at the very end:
FINAL: {"ref_left":0.000,"ref_right":0.000,"ref_y":0.300,"nail_left":0.000,"nail_right":0.000,"nail_y":0.500}`,
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
    const keys = ["ref_left", "ref_right", "ref_y", "nail_left", "nail_right", "nail_y"];
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

    // Objects must be in different locations: either separated horizontally (x) or vertically (y).
    // A vertical layout (card above/below finger) has x overlap but large y separation — that's OK.
    const xOverlap = Math.max(0, Math.min(coords.ref_right, coords.nail_right) - Math.max(coords.ref_left, coords.nail_left));
    const yGap     = Math.abs(coords.ref_y - coords.nail_y);
    const smallerWidth = Math.min(refWidth, nailWidth);
    if (xOverlap > smallerWidth * 0.8 && yGap < 0.15) {
      throw new Error(`Reference and nail appear to be at the same location (likely AI confusion): xOverlap=${xOverlap.toFixed(3)}, yGap=${yGap.toFixed(3)}`);
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
