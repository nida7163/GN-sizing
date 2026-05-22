# Grippy Sizing Tool

A mobile-first web app that measures your nail widths from a photo and recommends your Grippy press-on nail size.

## Stack

- **Vite + React 18** — fast dev server, instant HMR
- **TypeScript** — fully typed throughout
- **TailwindCSS** — Grippy design tokens (cobalt, cream, black)
- **Framer Motion** — page transitions and spring animations
- **Supabase** — session and measurement persistence
- **Lucide Icons**

## App Flow

```
/size    →  Landing → Hand Selection → Photo Upload
         →  Calibration → Nail Measurement (×5 fingers)
/results →  Recommended size + per-finger widths + Save / Shop CTAs
```

## Project Structure

```
src/
├── components/
│   ├── grippy/
│   │   ├── Button.tsx             # GrippyButton — primary / ghost / outline
│   │   ├── MeasurementCanvas.tsx  # Tap-to-measure canvas with marker overlay
│   │   ├── PageContainer.tsx      # Framer Motion slide transition wrapper
│   │   ├── ProgressBar.tsx        # Animated step progress bar
│   │   ├── ResultCard.tsx         # Animated size result card
│   │   └── UploadCard.tsx         # Camera + gallery upload with preview
│   └── ui/                        # shadcn/ui primitives
├── hooks/
│   ├── use-sizing.ts              # Sizing state — hand, image, calibration, measurements
│   └── ...
├── lib/
│   ├── sizeChart.ts               # XS–L size chart + getClosestSize()
│   ├── grippy-supabase.ts         # saveSizingSession(), fetchSession()
│   └── utils.ts
├── pages/
│   ├── Size.tsx                   # Multi-step sizing wizard
│   └── Results.tsx                # Results page
└── integrations/
    └── supabase/                  # Auto-generated Supabase client + types
supabase/
└── migrations/
    └── 20260522000000_grippy_sizing_tables.sql
```

## Design System

| Token        | Value       |
|--------------|-------------|
| Cobalt       | `#1A3FCC`   |
| Black        | `#0D0D0D`   |
| Cream        | `#F2EDE4`   |
| Font display | Unbounded   |
| Font mono    | DM Mono     |

Available in Tailwind as `grippy-cobalt`, `grippy-black`, `grippy-cream`, `font-unbounded`, `font-mono`.

## Size Chart (placeholder)

| Size | Thumb | Index | Middle | Ring | Pinky |
|------|-------|-------|--------|------|-------|
| XS   | 14 mm | 11 mm | 12 mm  | 11 mm | 8 mm |
| S    | 15 mm | 12 mm | 13 mm  | 12 mm | 9 mm |
| M    | 16 mm | 13 mm | 14 mm  | 13 mm | 10 mm|
| L    | 17 mm | 14 mm | 15 mm  | 14 mm | 11 mm|

`getClosestSize()` computes Euclidean distance from measured widths to each row and returns the nearest size with a 0–100% confidence score.

## Measurement Logic

- **Calibration** — user taps the left and right edge of a coin or card. Pixel distance is converted to a mm ratio and stored in session state. Placeholder: 100 px = 20 mm.
- **Nail widths** — user taps both edges of each nail on the canvas. Euclidean pixel distance is converted to mm using the calibration ratio.
- **Size engine** — measured widths are compared to `sizeChart.ts`. The closest match by Euclidean distance is recommended.

## Supabase Tables

```sql
profiles        (id, created_at)
sizing_sessions (id, profile_id, hand, recommended_size, confidence, created_at)
measurements    (id, session_id, thumb, index_finger, middle_finger, ring_finger, pinky)
```

Run the migration in `supabase/migrations/` against your project to create the tables.

## Roadmap

- [ ] AI nail edge detection (auto-find nail boundaries from photo)
- [ ] Customer accounts and saved profiles
- [ ] Multiple sizing sessions per user
- [ ] Shopify product integration (Shop Sets CTA)
- [ ] Physically accurate calibration with verified reference objects
- [ ] Right-hand measurement mirroring
