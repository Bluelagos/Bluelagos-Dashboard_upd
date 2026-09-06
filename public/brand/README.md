# Blue Lagos brand assets

Reserved slot for the official Blue Lagos logo. **No logo file exists in the
repository yet**, so the application currently shows a neutral wave glyph
(`lucide-react` `Waves`) in the sidebar, the mobile header, the briefing header
and the loading state.

## To add the logo

Drop the official file into this directory. That is the whole task — **no code
change is required.**

```
public/brand/blue-lagos.svg     ← preferred: scalable and recolourable
public/brand/blue-lagos.png     ← or .webp; a raster fallback works too
```

`lib/brand.ts` detects it on server start and it appears automatically in:

- the sidebar brand mark (`components/app-shell.tsx` → `BrandMark`)
- the mobile header (same component)
- the briefing header (`components/briefing.tsx`)
- the favicon and social card (`app/layout.tsx` → `generateMetadata`)

## How the file is chosen

If several files are present, `lib/brand.ts` prefers, in order:

1. **Format** — `.svg`, then `.webp`, `.png`, `.jpg`, `.jpeg`.
2. **Name** — a filename containing `blue-lagos`, `logo`, `wordmark` or `brand`
   beats an incidental one.

So `blue-lagos.svg` wins over `export-final-2.png`. Keeping exactly one official
file here avoids any ambiguity.

## Notes

- The mark renders inside a 36 × 36 px rounded container with
  `object-fit: contain`, so the aspect ratio is preserved and the logo is never
  stretched. A square or near-square lockup works best; a wide wordmark will be
  letterboxed.
- If the logo already contains the words "Blue Lagos", it will sit beside the
  wordmark in the sidebar. Remove the `.brand-copy` block in
  `components/app-shell.tsx` if that reads as duplication.
- The logo is **not** recoloured. Supply an approved monochrome or reversed
  variant if the mark needs to change between the Deep Coast and Warm Coast
  themes; the current implementation shows the same file in both.
- If the official palette differs from the current one, update the brand tokens
  in `app/globals.css` — `--brand`, `--brand-secondary` and the `--accent-*`
  family — rather than overriding colours in components.
