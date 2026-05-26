import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Undo2 } from "lucide-react";
import { Point } from "@/hooks/use-sizing";

interface MeasurementCanvasProps {
  imageUrl: string;
  onMeasure: (distancePx: number, left: Point, right: Point) => void;
  prompt: string;
  lineColor?: string;
  onImageError?: () => void;
  pixelsPerMm?: number; // when provided, show mm readout instead of px
  initialFirst?: Point;  // pre-populate first dot (review/re-measure mode)
  initialSecond?: Point; // pre-populate second dot
}

type TapState = { first: Point | null; second: Point | null };

export function MeasurementCanvas({
  imageUrl,
  onMeasure,
  prompt,
  lineColor = "#0D0D0D",
  onImageError,
  pixelsPerMm,
  initialFirst,
  initialSecond,
}: MeasurementCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const imageRef     = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── State (drives JSX re-renders) ─────────────────────────────────────────
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState({ x: 0, y: 0 });
  const [taps,       setTaps]       = useState<TapState>({ first: initialFirst ?? null, second: initialSecond ?? null });
  const [committed,  setCommitted]  = useState(false);
  const [imgFailed,  setImgFailed]  = useState(false);

  // ── Refs mirroring state — always current, safe to read in native listeners
  const zoomRef      = useRef(1);
  const panRef       = useRef({ x: 0, y: 0 });
  const tapsRef      = useRef<TapState>({ first: initialFirst ?? null, second: initialSecond ?? null });
  const committedRef = useRef(false);
  const lineColorRef = useRef(lineColor);
  const onMeasureRef = useRef(onMeasure);

  // Sync every render so event-handler refs are never stale
  zoomRef.current      = zoom;
  panRef.current       = pan;
  tapsRef.current      = taps;
  committedRef.current = committed;
  lineColorRef.current = lineColor;
  onMeasureRef.current = onMeasure;

  // ── Commit timer — tracked so we can cancel it on undo/reset/unmount ─────
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref copy of pixelsPerMm so native handlers always see the latest value
  const pixelsPerMmRef = useRef(pixelsPerMm);
  pixelsPerMmRef.current = pixelsPerMm;

  // ── Gesture tracking refs ─────────────────────────────────────────────────
  const didDrag          = useRef(false);
  const dragStart        = useRef({ x: 0, y: 0 });
  const panAtDragStart   = useRef({ x: 0, y: 0 });
  const tapPos           = useRef<{ clientX: number; clientY: number } | null>(null);
  const tapRect          = useRef<DOMRect | null>(null); // rect captured at touchstart
  const pinchStartDist   = useRef<number | null>(null);
  const pinchStartZoom   = useRef(1);
  const pinchWorldMid    = useRef({ x: 0, y: 0 });

  // ── Helpers (read from refs — always current) ─────────────────────────────
  const clamp = (px: number, py: number, z: number) => {
    const c = canvasRef.current;
    if (!c) return { x: px, y: py };
    return {
      x: Math.max(0, Math.min(px, c.width  * (1 - 1 / z))),
      y: Math.max(0, Math.min(py, c.height * (1 - 1 / z))),
    };
  };

  const toWorld = (clientX: number, clientY: number, rect?: DOMRect): Point => {
    const c     = canvasRef.current!;
    const r     = rect ?? c.getBoundingClientRect();
    const scale = c.width / r.width;
    const z     = zoomRef.current;
    const { x: px, y: py } = clamp(panRef.current.x, panRef.current.y, z);
    return {
      x: px + (clientX - r.left) * scale / z,
      y: py + (clientY - r.top)  * scale / z,
    };
  };

  // ── Draw — stored in a ref so native handlers always call the latest version
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const img    = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const z  = zoomRef.current;
    const lc = lineColorRef.current;
    const { x: px, y: py } = clamp(panRef.current.x, panRef.current.y, z);

    const sw = img.naturalWidth  / canvas.width;
    const sh = img.naturalHeight / canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      px * sw, py * sh,
      (canvas.width  / z) * sw,
      (canvas.height / z) * sh,
      0, 0, canvas.width, canvas.height,
    );

    const toScreen = (wx: number, wy: number) => ({
      sx: (wx - px) * z,
      sy: (wy - py) * z,
    });

    const { first, second } = tapsRef.current;
    if (first)  { const { sx, sy } = toScreen(first.x,  first.y);  marker(ctx, sx, sy); }
    if (second) { const { sx, sy } = toScreen(second.x, second.y); marker(ctx, sx, sy); }
    if (first && second) {
      const s1 = toScreen(first.x,  first.y);
      const s2 = toScreen(second.x, second.y);
      ctx.beginPath();
      ctx.moveTo(s1.sx, s1.sy);
      ctx.lineTo(s2.sx, s2.sy);
      ctx.strokeStyle = lc;
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const ppm   = pixelsPerMmRef.current;
      const label = ppm
        ? `${(Math.abs(second.x - first.x) / ppm).toFixed(1)} mm`
        : `${Math.round(Math.hypot(second.x - first.x, second.y - first.y))}px`;
      ctx.font      = "bold 14px 'DM Mono', monospace";
      ctx.fillStyle = lc;
      ctx.textAlign = "center";
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
      const tx = (s1.sx + s2.sx) / 2;
      const ty = Math.min(s1.sy, s2.sy) - 14;
      ctx.strokeText(label, tx, ty);
      ctx.fillText(label, tx, ty);
    }
  };

  function marker(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#0D0D0D"; ctx.globalAlpha = 0.25; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(sx, sy, 5,  0, Math.PI * 2);
    ctx.fillStyle = "#0D0D0D"; ctx.fill();
  }

  // ── commitTap — stored in a ref for the same reason as drawRef ───────────
  const commitTapRef = useRef<(cx: number, cy: number, rect?: DOMRect) => void>(() => {});
  commitTapRef.current = (cx: number, cy: number, rect?: DOMRect) => {
    if (committedRef.current) return;
    const pt   = toWorld(cx, cy, rect);
    const prev = tapsRef.current;
    let next: TapState;

    if (!prev.first) {
      next = { first: pt, second: null };
    } else if (!prev.second) {
      const { first } = prev;
      const second    = pt;
      const dist      = Math.hypot(second.x - first.x, second.y - first.y);
      next = { first, second };
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;
        committedRef.current = true;
        setCommitted(true);
        onMeasureRef.current(dist, first, second);
      }, 600);
    } else {
      // Third tap: cancel any pending commit and start fresh
      if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
      next = { first: pt, second: null };
    }

    tapsRef.current = next;
    setTaps(next);
    drawRef.current();
  };

  // ── Load image ────────────────────────────────────────────────────────────
  useEffect(() => {
    setImgFailed(false);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas    = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const maxW    = container.clientWidth;
      canvas.width  = maxW;
      canvas.height = maxW * (img.naturalHeight / img.naturalWidth);
      drawRef.current();
    };
    img.onerror = () => {
      setImgFailed(true);
      onImageError?.();
    };
    img.src = imageUrl;
  }, [imageUrl]); // onImageError intentionally omitted — stable callback ref

  // Cancel any pending commit timer on unmount to prevent firing into a dead component
  useEffect(() => () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
  }, []);

  // Redraw when state changes (covers undo + mouse path)
  useEffect(() => { drawRef.current(); }, [zoom, pan, taps]);

  // ── Native touch listeners (passive: false so preventDefault works) ───────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        pinchStartDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchStartZoom.current = zoomRef.current;

        // Anchor the world-space midpoint for zoom-toward-point behaviour
        const rect  = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        const z     = zoomRef.current;
        const px    = Math.max(0, Math.min(panRef.current.x, canvas.width  * (1 - 1 / z)));
        const py    = Math.max(0, Math.min(panRef.current.y, canvas.height * (1 - 1 / z)));
        const midX  = (t1.clientX + t2.clientX) / 2;
        const midY  = (t1.clientY + t2.clientY) / 2;
        pinchWorldMid.current = {
          x: px + (midX - rect.left) * scale / z,
          y: py + (midY - rect.top)  * scale / z,
        };
        didDrag.current = true;   // suppress accidental tap on end
        tapPos.current  = null;
      } else {
        const t                = e.touches[0];
        pinchStartDist.current = null;
        didDrag.current        = false;
        dragStart.current      = { x: t.clientX, y: t.clientY };
        panAtDragStart.current = { ...panRef.current };
        tapPos.current         = { clientX: t.clientX, clientY: t.clientY };
        tapRect.current        = canvas.getBoundingClientRect(); // capture now, before viewport can shift
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2 && pinchStartDist.current !== null) {
        const t1   = e.touches[0], t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const newZ = Math.max(1, Math.min(4, pinchStartZoom.current * dist / pinchStartDist.current));

        const rect  = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        const midX  = (t1.clientX + t2.clientX) / 2;
        const midY  = (t1.clientY + t2.clientY) / 2;
        const cMx   = (midX - rect.left) * scale;
        const cMy   = (midY - rect.top)  * scale;

        const newPx = Math.max(0, Math.min(pinchWorldMid.current.x - cMx / newZ, canvas.width  * (1 - 1 / newZ)));
        const newPy = Math.max(0, Math.min(pinchWorldMid.current.y - cMy / newZ, canvas.height * (1 - 1 / newZ)));

        zoomRef.current = newZ;
        panRef.current  = { x: newPx, y: newPy };
        setZoom(newZ);
        setPan({ x: newPx, y: newPy });
        drawRef.current();
        return;
      }

      if (e.touches.length === 1) {
        const t  = e.touches[0];
        const dx = t.clientX - dragStart.current.x;
        const dy = t.clientY - dragStart.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
        if (!didDrag.current || zoomRef.current <= 1) return;

        const rect  = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        const z     = zoomRef.current;
        const newPx = Math.max(0, Math.min(panAtDragStart.current.x - dx * scale / z, canvas.width  * (1 - 1 / z)));
        const newPy = Math.max(0, Math.min(panAtDragStart.current.y - dy * scale / z, canvas.height * (1 - 1 / z)));

        panRef.current = { x: newPx, y: newPy };
        setPan({ x: newPx, y: newPy });
        drawRef.current();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // Pinch released one finger — transition to single-finger pan
      if (e.touches.length === 1 && pinchStartDist.current !== null) {
        pinchStartDist.current = null;
        const t                = e.touches[0];
        dragStart.current      = { x: t.clientX, y: t.clientY };
        panAtDragStart.current = { ...panRef.current };
        didDrag.current        = true;
        tapPos.current         = null;
        tapRect.current        = null;
        return;
      }
      pinchStartDist.current = null;
      if (!didDrag.current && tapPos.current) {
        commitTapRef.current(tapPos.current.clientX, tapPos.current.clientY, tapRect.current ?? undefined);
      }
      didDrag.current = false;
      tapPos.current  = null;
      tapRect.current = null;
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
    canvas.addEventListener("touchend",   onTouchEnd,   { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   onTouchEnd);
    };
  }, []); // attached once; all live values read from refs

  // ── Mouse handlers (synthetic events are fine for mouse) ─────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    didDrag.current        = false;
    dragStart.current      = { x: e.clientX, y: e.clientY };
    panAtDragStart.current = { ...panRef.current };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didDrag.current = true;
    if (!didDrag.current || zoomRef.current <= 1) return;
    const c     = canvasRef.current!;
    const scale = c.width / c.getBoundingClientRect().width;
    const z     = zoomRef.current;
    const newPx = Math.max(0, Math.min(panAtDragStart.current.x - dx * scale / z, c.width  * (1 - 1 / z)));
    const newPy = Math.max(0, Math.min(panAtDragStart.current.y - dy * scale / z, c.height * (1 - 1 / z)));
    panRef.current = { x: newPx, y: newPy };
    setPan({ x: newPx, y: newPy });
    drawRef.current();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!didDrag.current) commitTapRef.current(e.clientX, e.clientY);
    didDrag.current = false;
  };

  const handleUndo = () => {
    if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
    const next: TapState = tapsRef.current.second
      ? { ...tapsRef.current, second: null }
      : { first: null, second: null };
    committedRef.current = false;
    setCommitted(false);
    tapsRef.current = next;
    setTaps(next);
    drawRef.current();
  };

  const isZoomed  = zoom > 1;
  const hintText  = committed ? "Tap Undo to adjust"
    : !taps.first ? (isZoomed ? "Tap the left edge" : "Pinch to zoom in first, then tap the left edge")
    : !taps.second ? "Now tap the right edge"
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
        {imgFailed ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <p className="font-mono text-sm text-grippy-cream/70">
              Photo couldn't load.
            </p>
            {onImageError && (
              <button
                onClick={onImageError}
                className="font-mono text-xs text-grippy-cream underline underline-offset-2 active:text-grippy-cream/70 transition-colors"
              >
                Retake photo
              </button>
            )}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full touch-none select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { didDrag.current = false; }}
          />
        )}
        {isZoomed && !imgFailed && (
          <div className="absolute top-2.5 right-2.5 bg-grippy-black/60 backdrop-blur-sm text-grippy-cream font-mono text-[11px] tabular-nums px-2 py-1 rounded-full pointer-events-none">
            {zoom.toFixed(1)}×
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 text-grippy-black/50 font-mono text-xs active:text-grippy-black transition-colors"
        >
          <Undo2 size={14} />
          Undo
        </button>
        <p className="font-mono text-[10px] text-grippy-black/30">
          {isZoomed ? "drag to pan" : "pinch to zoom"}
        </p>
      </div>
    </div>
  );
}
