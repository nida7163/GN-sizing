import { supabase } from "@/integrations/supabase/client";

export interface NailAnalysis {
  ref_left:  number; // fraction of image width
  ref_right: number;
  ref_y:     number; // fraction of image height (vertical center of reference object)
  nail_left: number;
  nail_right: number;
  nail_y:    number; // fraction of image height
}

export async function analyzeNailPhoto(
  file: File,
  referenceObject: string,
): Promise<NailAnalysis> {
  if (!supabase) throw new Error("Supabase not configured");
  const imageBase64 = await resizeAndEncode(file);
  const { data, error } = await supabase.functions.invoke("analyze-nail", {
    body: { imageBase64, mimeType: "image/jpeg", referenceObject },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as NailAnalysis;
}

// Resize to max 1200px wide and encode as JPEG base64 to keep payload small
function resizeAndEncode(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / img.naturalWidth);
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
