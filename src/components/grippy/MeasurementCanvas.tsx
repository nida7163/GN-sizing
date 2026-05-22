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

  // Single-touch drag state
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panAtDragStart = useRef({ x: 0, y: 0 });
  const tapPos = useRef<{ clientX: number; clientY: number } | null>(null);

  // Pinch-to-zoom state
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartZoom = useRef(1);
  const pinchWorldMid = useRef({ x: 0, y: 0 }); // midpoint in world coords at pinch start

  // World space = canvas pixel space so calibration distances stay consistent
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

    const scaleToNatW = img.naturalWidth / canvas.width;
    const scaleToNatH = img.naturalHeight / canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      px * scaleToNatW, py * scaleToNatH,
      (canvas.width / z) * scaleToNatW, (canvas.height / z) * scaleToNatH,
      0, 0, canvas.width, canvas.height,
    );

    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - px) * z,
      sy: (wy - py) * z,
    });

    const { first, second } = taps;
    if (first) { const { sx, sy } = toScreen(first.x, first.y); drawMarker(ctx, sx, sy); }
    if (second) { const { sx, sy } = toScreen(second.x, second.y); drawMarker(ctx, sx, sy); }
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
      const dist = Math.hypot(second.x - first.x, second.y - first.y);
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

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { setPan(p => clampPan(p.x, p.y, zoom)); }, [zoom, clampPan]);

  const getWorldPoint = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const { x: px, y: py } = clampPan(pan.x, pan.y, zoom);
    return {
      x: px + (clientX - rect.left) * scale / zoom,
      y: py + (clientY - rect.top) * scale / zoom,
    };
  }, [pan, zoom, clampPan]);

  const commitTap = useCallback((clientX: number, clientY: number) => {
    if (committed) return;
    const pt = getWorldPoint(clientX, clientY);
    setTaps(prev => {
      if (!prev.first) return { first: pt, second: null };
      if (!prev.second) {
        const { first } = prev;
        const second = pt;
        const dist = Math.hypot(second.x - first.x, second.y - first.y);
        setTimeout(() => { setCommitted(true); onMeasure(dist, first, second); }, 600);
        return { first, second };
      }
      return { first: pt, second: null };
    });
  }, [committed, onMeasure, getWorldPoint]);

  const handleUndo = () => {
    setCommitted(false);
    setTaps(prev => prev.second ? { ...prev, second: null } : { first: null, second: null });
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
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    setPan(clampPan(
      panAtDragStart.current.x - dx * scale / zoom,
      panAtDragStart.current.y - dy * scale / zoom,
      zoom,
    ));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!didDrag.current) commitTap(e.clientX, e.clientY);
    didDrag.current = false;
  };

  // ── Touch handlers (single-touch pan + pinch-to-zoom) ────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      // Start pinch
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartZoom.current = zoom;
      // Record world-space midpoint so we can zoom toward it
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      pinchWorldMid.current = getWorldPoint(midX, midY);
      didDrag.current = true; // block tap on touchend
      tapPos.current = null;
    } else {
      // Single touch
      const t = e.touches[0];
      pinchStartDist.current = null;
      didDrag.current = false;
      dragStart.current = { x: t.clientX, y: t.clientY };
      panAtDragStart.current = { ...pan };
      tapPos.current = { clientX: t.clientX, clientY: t.clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const newZoom = Math.max(1, Math.min(4, pinchStartZoom.current * dist / pinchStartDist.current));

      // Keep the pinch midpoint fixed on screen
      const canvas = canvasRef.current!;
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const rect = canvas.getBoundingClientRect();
      const canvasMx = (midX - rect.left) * scale;
      const canvasMy = (midY - rect.top) * scale;
      const newPan = clampPan(
        pinchWorldMid.current.x - canvasMx / newZoom,
        pinchWorldMid.current.y - canvasMy / newZoom,
        newZoom,
      );
      setZoom(newZoom);
      setPan(newPan);
      return;
    }

    // Single-touch pan
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.x;
      const dy = t.clientY - dragStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
      if (!didDrag.current || zoom <= 1) return;
      e.preventDefault();
      const canvas = canvasRef.current!;
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      setPan(clampPan(
        panAtDragStart.current.x - dx * scale / zoom,
        panAtDragStart.current.y - dy * scale / zoom,
        zoom,
      ));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && pinchStartDist.current !== null) {
      // Went from 2 fingers to 1 — switch to pan mode for remaining finger
      pinchStartDist.current = null;
      const t = e.touches[0];
      dragStart.current = { x: t.clientX, y: t.clientY };
      panAtDragStart.current = { ...pan };
      didDrag.current = true; // don't accidentally tap after a pinch
      tapPos.current = null;
      return;
    }
    pinchStartDist.current = null;
    if (!didDrag.current && tapPos.current) {
      commitTap(tapPos.current.clientX, tapPos.current.clientY);
    }
    didDrag.current = false;
    tapPos.current = null;
  };

  const changeZoom = (delta: number) => {
    setZoom(z => Math.max(1, Math.min(4, Math.round((z + delta) * 2) / 2)));
  };

  const isZoomed = zoom > 1;
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
        style={{ cursor: isZoomed ? "grab" : "crosshair" }}
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
        {/* Zoom level badge — visible on the canvas when zoomed */}
        {isZoomed && (
          <div className="absolute top-2.5 right-2.5 bg-grippy-black/60 backdrop-blur-sm text-grippy-cream font-mono text-[11px] tabular-nums px-2 py-1 rounded-full pointer-events-none">
            {zoom.toFixed(1)}×
          </div>
        )}
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

        {/* Zoom controls — prominent pill, lights up when zoomed */}
        <div className={`flex items-center gap-1 rounded-full px-1 py-1 transition-colors ${
          isZoomed ? "bg-grippy-cobalt/15 ring-1 ring-grippy-cobalt/30" : "bg-grippy-black/8"
        }`}>
          <button
            onClick={() => changeZoom(-0.5)}
            disabled={!isZoomed}
            aria-label="Zoom out"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isZoomed
                ? "text-grippy-cobalt active:bg-grippy-cobalt/20"
                : "text-grippy-black/25"
            }`}
          >
            <ZoomOut size={18} />
          </button>
          <span className={`font-mono text-[11px] tabular-nums w-9 text-center select-none transition-colors ${
            isZoomed ? "text-grippy-cobalt font-semibold" : "text-grippy-black/30"
          }`}>
            {zoom.toFixed(1)}×
          </span>
          <button
            onClick={() => changeZoom(0.5)}
            disabled={zoom >= 4}
            aria-label="Zoom in"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              zoom < 4
                ? "text-grippy-black/60 active:bg-grippy-black/10 active:text-grippy-black"
                : "text-grippy-black/20"
            }`}
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Pinch-to-zoom hint — only shown at 1× */}
      {!isZoomed && (
        <p className="font-mono text-[10px] text-grippy-black/25 text-center -mt-1">
          Pinch or tap + to zoom · drag to pan
        </p>
      )}
    </div>
  );
}
