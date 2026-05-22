import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Point } from "@/hooks/use-sizing";

interface MeasurementCanvasProps {
  imageUrl: string;
  /** Called when both points are tapped. Returns pixel distance. */
  onMeasure: (distancePx: number, left: Point, right: Point) => void;
  /** Label shown above the canvas (e.g. "Tap both edges of your Thumb") */
  prompt: string;
  /** Overlay color for measurement lines */
  lineColor?: string;
}

type TapState = { first: Point | null; second: Point | null };

export function MeasurementCanvas({
  imageUrl,
  onMeasure,
  prompt,
  lineColor = "#1A3FCC",
}: MeasurementCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [taps, setTaps] = useState<TapState>({ first: null, second: null });
  const [zoom, setZoom] = useState(1);
  const [committed, setCommitted] = useState(false);

  // Draw image + markers + line
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const { first, second } = taps;

    if (first) {
      drawMarker(ctx, first, "#1A3FCC");
    }
    if (second) {
      drawMarker(ctx, second, "#1A3FCC");
    }
    if (first && second) {
      // Line
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Distance label
      const dist = Math.sqrt(Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2));
      const mx = (first.x + second.x) / 2;
      const my = (first.y + second.y) / 2 - 14;
      ctx.font = "bold 13px 'DM Mono', monospace";
      ctx.fillStyle = lineColor;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(dist)}px`, mx, my);
    }
  }, [taps, lineColor]);

  function drawMarker(ctx: CanvasRenderingContext2D, p: Point, color: string) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Load image and size canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const maxW = container.clientWidth;
      const ratio = img.naturalHeight / img.naturalWidth;
      canvas.width = maxW;
      canvas.height = maxW * ratio;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl, draw]);

  useEffect(() => {
    draw();
  }, [taps, draw]);

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
        const first = prev.first;
        const second = pt;
        const dist = Math.sqrt(Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2));
        // Commit after short delay so user sees the line
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
    setTaps(prev => {
      if (prev.second) return { ...prev, second: null };
      return { first: null, second: null };
    });
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Prompt */}
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

      {/* Tap hint */}
      <p className="font-mono text-[11px] text-grippy-black/40 text-center">
        {!taps.first ? "Tap the left edge" : !taps.second ? "Now tap the right edge" : "Measuring…"}
      </p>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-grippy-black shadow-xl"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          onClick={handleTap}
          onTouchStart={handleTap}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 text-grippy-black/50 font-mono text-xs active:text-grippy-black transition-colors"
        >
          <Undo2 size={14} />
          Undo
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            className="text-grippy-black/50 active:text-grippy-black transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="text-grippy-black/50 active:text-grippy-black transition-colors"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
