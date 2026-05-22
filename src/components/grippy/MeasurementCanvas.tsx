import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2 } from "lucide-react";
import { Point } from "@/hooks/use-sizing";

interface MeasurementCanvasProps {
  imageUrl: string;
  onMeasure: (distancePx: number, left: Point, right: Point) => void;
  prompt: string;
  lineColor?: string;
}

type TapState = { first: Point | null; second: Point | null };

export function MeasurementCanvas({
  imageUrl,
  onMeasure,
  prompt,
  lineColor = "#0D0D0D",
}: MeasurementCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [taps, setTaps] = useState<TapState>({ first: null, second: null });
  const [committed, setCommitted] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const { first, second } = taps;
    if (first) drawMarker(ctx, first.x, first.y);
    if (second) drawMarker(ctx, second.x, second.y);
    if (first && second) {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const dist = Math.hypot(second.x - first.x, second.y - first.y);
      ctx.font = "bold 13px 'DM Mono', monospace";
      ctx.fillStyle = lineColor;
      ctx.textAlign = "center";
      ctx.fillText(
        `${Math.round(dist)}px`,
        (first.x + second.x) / 2,
        (first.y + second.y) / 2 - 14,
      );
    }
  }, [taps, lineColor]);

  function drawMarker(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#0D0D0D";
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#0D0D0D";
    ctx.fill();
  }

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const maxW = container.clientWidth;
      canvas.width = maxW;
      canvas.height = maxW * (img.naturalHeight / img.naturalWidth);
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl, draw]);

  useEffect(() => { draw(); }, [draw]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (committed) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    setTaps(prev => {
      if (!prev.first) return { first: pt, second: null };
      if (!prev.second) {
        const { first } = prev;
        const second = pt;
        const dist = Math.hypot(second.x - first.x, second.y - first.y);
        setTimeout(() => {
          setCommitted(true);
          onMeasure(dist, first, second);
        }, 600);
        return { first, second };
      }
      return { first: pt, second: null };
    });
  };

  const handleUndo = () => {
    setCommitted(false);
    setTaps(prev => prev.second ? { ...prev, second: null } : { first: null, second: null });
  };

  const hintText = !taps.first
    ? "Tap the left edge"
    : !taps.second
    ? "Now tap the right edge"
    : "Measuring…";

  return (
    <div className="w-full flex flex-col gap-3">
      <AnimatePresence mode="wait">
        <motion.p
          key={prompt}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="font-unbounded text-sm font-semibold text-grippy-black text-center px-2"
        >
          {prompt}
        </motion.p>
      </AnimatePresence>

      <p className="font-mono text-[11px] text-grippy-black/40 text-center">{hintText}</p>

      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-grippy-black shadow-xl"
      >
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          onClick={handleTap}
          onTouchStart={handleTap}
        />
      </div>

      <div className="flex items-center px-1">
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 text-grippy-black/50 font-mono text-xs active:text-grippy-black transition-colors"
        >
          <Undo2 size={14} />
          Undo
        </button>
      </div>
    </div>
  );
}
