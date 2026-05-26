# Grippy Fit — Nail Sizing Tool

A mobile-first web app that measures nail widths from a photo and recommends the correct Grippy press-on nail size (XS–L) for each hand shape.

## Stack

- **Vite 5 + React 18** — SWC for fast refresh
- **TypeScript 5** — fully typed throughout
- **Tailwind CSS 3** — Grippy design tokens (cobalt, cream, black)
- **Framer Motion 12** — page transitions and spring animations
- **React Router 6** — `/size` and `/results` routes
- **Lucide React** — icons
- **Supabase** *(optional)* — session persistence when `VITE_SUPABASE_URL` is set

## App Flow

```
/size
  Step 0  Landing          — continue saved progress or start over
  Step 1  Hand selection   — left or right
  Step 2  Shape selection  — Short Round or Short Oval
  Steps 3–7  Per finger (Thumb → Pinky):
              ① Upload photo
              ② Calibrate    — tap both edges of a reference object (coin or card)
              ③ Measure      — tap both edges of the nail at its widest point

/results
  Recommended size + confidence score
  Per-finger width table with diff bars
  Share (gift mode) / Retake / Shop CTAs
```

## Project Structure

```
src/
├── pages/
│   ├── Size.tsx              Multi-step sizing wizard (steps 0–7)
│   └── Results.tsx           Results: size, confidence, per-finger breakdown, CTAs
├── hooks/
│   └── use-sizing.ts         All sizing state — hand, shape, calibrations, measurements, step
├── lib/
│   ├── sizeChart.ts          XS–L size chart + getClosestSize() with size-up rule
│   ├── grippy-supabase.ts    saveSizingSession() / fetchSession() (optional)
│   └── utils.ts              Tailwind class merging
├── components/grippy/
│   ├── MeasurementCanvas.tsx Pinch/pan/zoom canvas with 2-tap measurement + mm label
│   ├── UploadCard.tsx        Camera + gallery upload
│   ├── ResultCard.tsx        Animated size badge + confidence bar
│   ├── Button.tsx            GrippyButton variants
│   ├── ProgressBar.tsx       Animated step progress
│   └── PageContainer.tsx     Framer Motion slide wrapper
└── integrations/supabase/
    └── client.ts             Supabase client (no-ops when env vars absent)
```

## Design System

| Token        | Value       | Tailwind class       |
|--------------|-------------|----------------------|
| Cobalt       | `#1A3FCC`   | `text-grippy-cobalt` |
| Black        | `#0D0D0D`   | `text-grippy-black`  |
| Cream        | `#F2EDE4`   | `bg-grippy-cream`    |
| Font display | Unbounded   | `font-unbounded`     |
| Font mono    | DM Mono     | `font-mono`          |

Background utility: `grippy-surface` (cream bg + black text). Safe area insets: `pt-safe` / `pb-safe`.

## Size Chart

| Size | Thumb | Index | Middle | Ring | Pinky |
|------|-------|-------|--------|------|-------|
| XS   | 14 mm | 10 mm | 11 mm  | 10 mm | 8 mm |
| S    | 15 mm | 11 mm | 12 mm  | 11 mm | 9 mm |
| M    | 16 mm | 12 mm | 13 mm  | 12 mm | 10 mm |
| L    | 17 mm | 13 mm | 14 mm  | 13 mm | 11 mm |

Both shape variants (Short Round, Short Oval) currently share the same width values.

## Measurement & Sizing Logic

### Calibration
User taps the left and right edge of a reference object placed beside the nail:

| Object       | Width |
|--------------|-------|
| Penny / Dime | 19 mm |
| Quarter      | 24 mm |
| Credit card  | 86 mm |

`pixelsPerMm = tapPixelWidth / referenceMm` — stored per finger. A sanity check rejects taps yielding < 1.5 or > 30 px/mm (catches accidental nail taps instead of card edges).

### Nail measurement
User taps both edges of the nail. `widthMm = Math.abs(right.x - left.x) / pixelsPerMm`.

### Size selection (`getClosestSize`)
1. Compute Euclidean distance from all 5 measurements to each size row.
2. Sort ascending by distance.
3. **Size-up rule**: if the 2nd-closest size is within 1.5 mm of the best distance *and* is larger, choose the larger size (`sizedUp: true`). Press-ons can be filed down but not enlarged.
4. **Confidence**: `max(40, round((1 − min(distance, 12) / 12) × 100))%`.

### Interactive review (during measurement flow)
Tapping a completed finger chip expands a review panel with:
- **Nail edges** tab — live re-tappable canvas pre-populated with original dots; committing updates the measurement
- **Card edges** tab — live re-tappable canvas for the calibration; recalibrating automatically recalculates the nail mm

## State & Persistence

`use-sizing` stores all state in React. Steps 1–5 are auto-persisted to `localStorage` (excluding blob image URLs, which are tab-local). On reload the user lands on step 0 and can continue or start over. Completing all 5 fingers clears localStorage.

Key actions:
- `recordMeasurement` — commit a finger and advance to next
- `undoMeasurement` — remove the most recent finger and go back
- `updateMeasurementForFinger` — re-measure a specific finger without disrupting flow
- `recalibrateFinger` — update calibration and cascade-recalculate that finger's mm
- `restoreForRetake` — partial-restore state for a single-finger redo from the Results page

## Special Modes

**Demo mode** — `?demo=1` URL param (or "Demo mode" link on landing) skips photo flow and loads pre-set measurements that sit between S and M, triggering the size-up nudge.

**Gift mode** — `?gift=1` activates a recipient-facing landing copy. The recipient measures their nails; the Results page builds a shareable URL encoding all measurements so the gifter sees the size to order.

**Shared view** — Results page opened via gift share link shows a read-only view with size, measurements, and a Shop CTA. No retake controls.

## Supabase (Optional)

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to enable auto-save.

```sql
sizing_sessions (id, user_id, hand, recommended_size, shape, confidence, created_at)
measurements    (session_id, thumb, index_finger, middle_finger, ring_finger, pinky)
```

When configured, Results auto-saves the session on first render and shows a "Saved ✓" badge.

## Local Dev

```bash
npm install
npm run dev       # Vite dev server
npm run build     # tsc + Vite production build
npm run lint      # ESLint
```

## Roadmap

- [ ] AI nail edge detection (auto-suggest tap points from photo)
- [ ] Saved profiles and measurement history
- [ ] Shopify variant integration (deep-link to correct product)
- [ ] Right-hand mirroring for left-hand sizing
- [ ] Per-shape distinct size charts as data is collected
