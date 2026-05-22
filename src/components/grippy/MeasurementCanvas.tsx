import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2, ZoomIn, ZoomOut } from "lucide-react";
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [committed, setCommitted] = useState(false);

  // Drag state as refs to avoid re-renders during drag
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panAtDragStart = useRef({ x: 0, y: 0 });
  const tapPos = useRef<{ clientX: number; clientY: number } | null>(null);

  // World space = canvas pixel space (0 to canvas.width/height).
  // This keeps measurements in the same unit as the original so calibration still works.
  const clampPan = useCallback((px: number, py: number, z: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: px, y: py };
    return {
      x: Math.max(0, Math.min(px, canvas.width * (1 - 1 / z))),
      y: Math.max(0, Math.min(py, canvas.height * (1 - 1 / z))),
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const z = zoom;
    const { x: px, y: py } = clampPan(pan.x, pan.y, z);

    // Convert canvas-pixel pan/vis to natural-image-pixel source rect
    const scaleToNatW = img.naturalWidth / canvas.width;
    const scaleToNatH = img.naturalHeight / canvas.height;
    const srcX = px * scaleToNatW;
    const srcY = py * scaleToNatH;
    const srcW = (canvas.width / z) * scaleToNatW;
    const srcH = (canvas.height / z) * scaleToNatH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

    // Helpers to convert world (canvas-pixel) coords → screen canvas coords
    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - px) * z,
      sy: (wy - py) * z,
    });

    const { first, second } = taps;

    if (first) {
      const { sx, sy } = toScreen(first.x, first.y);
      drawMarker(ctx, sx, sy);
    }
    if (second) {
      const { sx, sy } = toScreen(second.x, second.y);
      drawMarker(ctx, sx, sy);
    }
    if (first && second) {
      const s1 = toScreen(first.x, first.y);
      const s2 = toScreen(second.x, second.y);

      ctx.beginPath();
      ctx.moveTo(s1.sx, s1.sy);
      ctx.lineTo(s2.sx, s2.sy);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const dist = Math.sqrt(
        Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2)
      );
      const mx = (s1.sx + s2.sx) / 2;
      const my = (s1.sy + s2.sy) / 2 - 14;
      ctx.font = "bold 13px 'DM Mono', monospace";
      ctx.fillStyle = lineColor;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(dist)}px`, mx, my);
    }
  }, [taps, zoom, pan, lineColor, clampPan]);

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

  // Load image and size canvas to fill container width
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => {
    draw();
  }, [draw]);

  // When zooming out, clamp pan so it stays in bounds
  useEffect(() => {
    setPan(p => clampPan(p.x, p.y, zoom));
  }, [zoom, clampPan]);

  // Convert screen tap position → world (canvas-pixel) coordinates
  const getWorldPoint = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
    const { x: px, y: py } = clampPan(pan.x, pan.y, zoom);
    return { x: px + canvasX / zoom, y: py + canvasY / zoom };
  };

  const commitTap = useCallback((clientX: number, clientY: number) => {
    if (committed) return;
    const pt = getWorldPoint(clientX, clientY);
    setTaps(prev => {
      if (!prev.first) return { first: pt, second: null };
      if (!prev.second) {
        const { first } = prev;
        const second = pt;
        const dist = Math.sqrt(
          Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2)
        );
        setTimeout(() => {
          setCommitted(true);
          onMeasure(dist, first, second);
        }, 600);
        return { first, second };
      }
      return { first: pt, second: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, onMeasure, pan, zoom, clampPan]);

  const handleUndo = () => {
    setCommitted(false);
    setTaps(prev => {
      if (prev.second) return { ...prev, second: null };
      return { first: null, second: null };
    });
  };

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panAtDragStart.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    if (!didDrag.current || zoom <= 1) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setPan(clampPan(
      panAtDragStart.current.x - (dx * scale) / zoom,
      panAtDragStart.current.y - (dy * scale) / zoom,
      zoom,
    ));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!didDrag.current) commitTap(e.clientX, e.clientY);
    didDrag.current = false;
  };

  // ── Touch handlers ────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    didDrag.current = false;
    dragStart.current = { x: t.clientX, y: t.clientY };
    panAtDragStart.current = { ...pan };
    tapPos.current = { clientX: t.clientX, clientY: t.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - dragStart.current.x;
    const dy = t.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    if (!didDrag.current || zoom <= 1) return;

    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setPan(clampPan(
      panAtDragStart.current.x - (dx * scale) / zoom,
      panAtDragStart.current.y - (dy * scale) / zoom,
      zoom,
    ));
  };

  const handleTouchEnd = () => {
    if (!didDrag.current && tapPos.current) {
      commitTap(tapPos.current.clientX, tapPos.current.clientY);
    }
    didDrag.current = false;
    tapPos.current = null;
  };

  const hintText = !taps.first
    ? "Zoom in on the nail, then tap the left edge"
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
        style={{ cursor: zoom > 1 ? "grab" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full touch-none select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { didDrag.current = false; }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

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
            onClick={() => setZoom(z => Math.max(1, z - 0.5))}
            disabled={zoom <= 1}
            className="text-grippy-black/50 active:text-grippy-black transition-colors disabled:opacity-30"
          >
            <ZoomOut size={18} />
          </button>
          <span className="font-mono text-[10px] text-grippy-black/40 tabular-nums w-8 text-center">
            {zoom.toFixed(1)}×
          </span>
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.5))}
            disabled={zoom >= 4}
            className="text-grippy-black/50 active:text-grippy-black transition-colors disabled:opacity-30"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
