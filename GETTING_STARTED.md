# Getting Started

## Prerequisites

- Node.js 18+ (recommend [nvm](https://github.com/nvm-sh/nvm))
- A Supabase project ([supabase.com](https://supabase.com))

## 1. Clone and install

```bash
git clone https://github.com/nida7163/GN-sizing.git
cd GN-sizing
npm install
```

## 2. Set environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Find both values in your Supabase dashboard under **Project Settings → API**.

## 3. Run the database migration

In your Supabase dashboard, open the **SQL Editor** and run the contents of:

```
supabase/migrations/20260522000000_grippy_sizing_tables.sql
```

This creates the `profiles`, `sizing_sessions`, and `measurements` tables with RLS policies.

Alternatively, if you have the Supabase CLI installed and linked:

```bash
supabase db push
```

## 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173/size](http://localhost:5173/size) to see the sizing tool.

## 5. Try the flow

1. **Landing** — tap "Start Sizing"
2. **Hand selection** — pick left or right hand
3. **Photo upload** — use Camera or Gallery. Lay your hand flat on a plain surface with a coin or credit card visible for calibration
4. **Calibration** — tap the left edge, then the right edge of the coin/card
5. **Nail measurement** — tap both edges of each nail, finger by finger (thumb → pinky)
6. **Results** — your recommended Grippy size appears with individual nail widths

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests with Vitest |

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/pages/Size.tsx` | Full multi-step sizing wizard |
| `src/pages/Results.tsx` | Results page |
| `src/lib/sizeChart.ts` | Size chart + `getClosestSize()` |
| `src/hooks/use-sizing.ts` | All sizing state management |
| `src/components/grippy/MeasurementCanvas.tsx` | Interactive tap-to-measure canvas |
| `src/lib/grippy-supabase.ts` | Supabase insert/fetch helpers |

## Updating the Size Chart

Open `src/lib/sizeChart.ts` and edit the `sizeChart` object. Values are in mm — one entry per finger in order: thumb, index, middle, ring, pinky.

```ts
export const sizeChart = {
  XS: [14, 11, 12, 11, 8],
  S:  [15, 12, 13, 12, 9],
  M:  [16, 13, 14, 13, 10],
  L:  [17, 14, 15, 14, 11],
};
```

## Deploying to Vercel

```bash
npm run build
```

Then connect your GitHub repo to [Vercel](https://vercel.com) and add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) in the project settings. Vercel auto-detects Vite and deploys on every push to `main`.
