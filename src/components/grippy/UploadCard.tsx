import { useRef } from "react";
import { motion } from "framer-motion";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadCardProps {
  onFile: (file: File) => void;
  preview?: string | null;
  className?: string;
}

export function UploadCard({ onFile, preview, className }: UploadCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  if (preview) {
    return (
      <motion.div
        className={cn("relative w-full rounded-3xl overflow-hidden bg-grippy-black", className)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <img src={preview} alt="Hand preview" className="w-full object-cover" style={{ maxHeight: "60vh" }} />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-grippy-cream text-grippy-black rounded-full px-4 py-2.5 font-unbounded text-xs font-semibold shadow-lg"
        >
          <RefreshCw size={13} />
          Retake
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center gap-3 bg-grippy-black text-grippy-cream rounded-3xl p-8 active:scale-95 transition-transform"
        >
          <Camera size={28} />
          <span className="font-unbounded text-xs font-semibold">Camera</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-3 bg-grippy-cream text-grippy-black border border-grippy-black/10 rounded-3xl p-8 active:scale-95 transition-transform"
        >
          <ImagePlus size={28} />
          <span className="font-unbounded text-xs font-semibold">Gallery</span>
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </motion.div>
  );
}
