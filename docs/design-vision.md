# Direction: The Watermark (Printer's Mark, variant β)

> **Status: ARCHIVED.** This brief captures the *original* direction proposal — pre-ship, before the Fog + Ochre palette was locked. Specifics here (teal, JetBrains Mono, 28px watermark, kind-filter chip row, separate `/all` page, `og:image` v1) have been superseded. The canonical visual spec is `DESIGN.md` + `DESIGN.json` (Fog + Ochre, Geist Mono, 32px watermark, tagging/search/og:image deferred to their own issues). Read this for the philosophical center; defer to the spec for any concrete value.

**Center:** md is a printer's mark, made *persistent and small* rather than tucked at the end. A fixed corner glyph that says "this is published by md" without taking screen space — the way old letterheads placed a monogram in the corner of every page.

## The structural decisions

### Reader page (`/v/<slug>`)

- **No top header. No footer.** The doc fills the screen.
- **A persistent corner glyph.** Bottom-right of the viewport, a 28px square containing a small SVG mark — a custom typographic ligature (`m`/`d` interlocked, or a quill, or an ampersand-style bigram). Always visible, never moves, never claims attention.
- **The glyph is the affordance.** Clicking it opens a tiny tooltip-shaped panel: `md.niftymonkey.dev` + `view raw` + `copy link`. Three actions, no chrome around them. Click outside dismisses.
- **The glyph honors `prefers-reduced-motion`.** No idle animation; tooltip transitions only on click.
- **Page chrome budget: ~2%.** A 28px square in the corner is the entire chrome.

### Operator home (`/`)

- **The watermark is on this page too.** Same corner glyph, same tooltip — but the tooltip in operator context shows "all docs" + "sign out" + "API". The watermark is the operator's nav.
- **Upload-first center surface.** Same upload box logic as Colophon (drop/paste/file picker), but visually different — the dropzone has a thicker dashed border, more aggressive empty-state copy, more "ready to go" energy.
- **A horizontal kind-filter strip above the upload box.** `All · Notes · Reps · Synthesis · Other` as small toggleable pill rows that filter the recent list. Filter is sticky in localStorage.
- **A single-row recent list below the dropzone.** 8 docs at most, scrollable horizontally on touch. Each is a tight typographic card with title + date.
- **`/all` is a separate page** (not the home) that shows the full list with search + pagination once they ship.

### Edit surface (`/edit/<slug>`)

- **Full-screen mono editor with the watermark in the corner.** Title field is a tiny inline strip at the top, almost transparent. The watermark's tooltip in edit context shows "save" + "cancel" + "view raw" — the watermark is the edit toolbar.
- **No top bar.** No save button visible by default. `⌘ + S` saves; the watermark briefly pulses to confirm.

### Unfurl card

- `og:title` = doc title.
- `og:description` = first sentence + a small leading mark `◆ ` so the unfurl preview also carries a mark.
- No `og:image` v1.
- Description prefix is the watermark's textual equivalent.

### Mobile reader

- The corner glyph moves to bottom-left on mobile (right thumb covers the bottom-right zone on most phones; bottom-left is more tappable).
- Tap glyph → same tooltip with the same three actions.

### Raw access

- Primary: tap watermark → "view raw" link.
- Hidden: `?raw=1`.

## Visual language

- **Color:** cool greys + a single saturated mark color. Light: bone `oklch(96% 0.005 70)`, ink `oklch(20% 0.012 60)`. Mark color: deep teal `oklch(38% 0.10 200)`. Dark: asymmetric, ink bg + bone fg. Mark color slightly lifted in dark.
- **Type:** sans body (NO serif). Inter Tight 400/600 for everything reader-facing. JetBrains Mono for code. This is the move that most differentiates Watermark from Colophon — Watermark commits to a contemporary sans voice; Colophon is editorial-serif.
  - Body: Inter Tight 400, 1.0625rem, line-height 1.6.
  - Display: Inter Tight 700, scale-driven hierarchy.
  - Mono: JetBrains Mono.
- **The watermark mark.** A custom SVG. Proposal: a serifed monogram of `md` rotated subtly, or a fleuron-style mark that reads as a brand bug. Identical across all surfaces.
- **Code blocks:** unframed. `pre` has a teal hairline left rule (THIS is the one place a left rule is justified — it carries the brand mark into the code). Background is paper-warm.
- **Mermaid diagrams:** centered with no caption.
- **Inline links:** teal underline at rest. Hover: underline thickens.

## What this enables

- The brand mark is omnipresent without being loud. Recipients across many docs build muscle memory for the corner glyph.
- The watermark becomes the universal nav — operator gets an elegant minimal toolbar across every surface; reader gets an unobtrusive affordance.
- Sans body reads more like a tool than a literary publication. Honest about what md is.

## What this risks

- **The glyph must be a real design artifact, not a placeholder.** A bad mark is worse than no mark. This direction's success rises and falls with the quality of the SVG.
- **A persistent corner element is a commitment.** It needs to NOT be eye-pulling or it will drag attention away from the doc. Sized at 28px and very low contrast, it should disappear when the reader is reading and reappear when the eye rests.
- **Sans body for prose is less comfortable for very long reads** than serif. md docs are usually short-medium, so this is acceptable, but a 5000-word essay would feel stronger in Colophon's serif body.
- **The watermark as universal nav** is a strong UX bet. If users don't discover the click affordance, the operator surface is too austere.

## What this honors / violates

- Honors PRODUCT.md principle 2 (resist category reflex) — sans + teal + tiny corner glyph is unusual.
- Honors principle 4 (tool, not portfolio) — the mark exists, but it's smaller than any other direction's branding.
- The persistent mark is a subtle violation of "quietly distinctive" — it's *consistently* present. But it's small enough to qualify as quiet by surface area.

## How this differs from Colophon

| Decision | Colophon (α) | Watermark (β) |
|---|---|---|
| Mark placement | End of doc, scrolls into view | Corner of viewport, always visible |
| Mark form | Typographic ornament + sans label | Custom SVG glyph + click-tooltip |
| Body type | Serif (Source Serif 4) | Sans (Inter Tight) |
| Brand color | Faded sepia | Deep teal |
| Operator nav | None at top, recent list below | Watermark IS the nav |
| Editorial vs tool feel | Editorial | Tool |
| Mobile mark position | Doc tail (unchanged) | Bottom-left (touch-optimized) |
