---
name: md.niftymonkey.dev
description: A markdown share service designed as a printer's mark — minimal chrome, fog-and-ochre palette, a persistent corner watermark that doubles as the universal nav.
colors:
  paper: "oklch(95% 0.008 145)"
  paper-warm: "oklch(92% 0.012 140)"
  ink: "oklch(24% 0.014 240)"
  ink-warm: "oklch(92% 0.012 100)"
  border-day: "oklch(85% 0.012 140)"
  border-night: "oklch(32% 0.014 220)"
  muted-day: "oklch(48% 0.018 200)"
  muted-night: "oklch(64% 0.018 110)"
  dark-fog: "oklch(19% 0.014 220)"
  dark-fog-warm: "oklch(23% 0.014 220)"
  ochre: "oklch(64% 0.14 85)"
  ochre-deep: "oklch(54% 0.16 80)"
  ochre-night: "oklch(76% 0.14 85)"
typography:
  display:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 2vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
  label:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.04em"
    fontFeature: '"tnum"'
  code:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
  gutter: "24px"
  reading: "min(65ch, 100%)"
  full: "min(80ch, 100%)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "9px 18px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    typography: "{typography.label}"
  button-ghost-hover:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
  toolbar-button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.muted-day}"
    rounded: "{rounded.md}"
    padding: "0"
    size: "32px"
  toolbar-button-active:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.paper}"
  watermark:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ochre}"
    rounded: "{rounded.md}"
    size: "32px"
  input-text:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    typography: "{typography.body}"
  list-row:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
    typography: "{typography.title}"
  code-block:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
    typography: "{typography.code}"
---

# Design System: md.niftymonkey.dev

## 1. Overview

**Creative North Star: "The Printer's Mark"**

md is a share tool. Recipients land on a `/v/<slug>` link cold — usually from a DM or chat — read the doc, and close the tab. The interface gets out of their way. A small watermark in the corner of every surface names the publisher (md) without claiming the page; clicking it reveals a tooltip with the few actions the reader needs (raw view, copy link, width toggle). The doc dominates; md is the bug in the corner that says "this came from a place that cares about typography."

The system rejects four neighbors that share its zip code: SaaS landing-page tropes (gradient hero metrics, identical card grids, glassmorphism, "trusted by" logo strips); Notion / Medium clones (big serif H1s in narrow columns, blockquote-heavy stylings); over-designed personal portfolios (gradient text, scroll-jacking, mouse-trail effects); and the generic dev-tool category reflex (zinc-950 + Inter + neon accent + default system-dark — the Vercel-stack template look). The Linear / Raycast lane is borrowed for *discipline* — restraint, scale-driven hierarchy, mono micro-type — not for its palette.

Both themes get equal craft. Light is fog cream — the working scene of writing or rereading a doc on a sunny desk. Dark is dark fog with paper-warm fg — the late-night scene of a dev re-reading a shared note on a dim monitor. Neither is a default; each is its own designed atmosphere, asymmetric in palette rather than inverted.

**Key Characteristics:**

- Single-family sans (Inter Tight, weight-driven) for everything, mono (Geist Mono) only for code blocks and chrome micro-type (slugs, dates, timestamps, kbd hints).
- Tinted neutrals never use `#fff` or `#000` or zero-chroma neutrals. Light: warm fog cream. Dark: cool dark fog with paper-warm fg.
- One accent color, ochre, used on ≤ 5% of any rendered surface: focus rings, link underlines on hover, code-block leading rule, text selection, watermark glyph, the W1 underline-draw on the watermark on hover.
- Tactile flat. Depth via tonal layering (paper vs. paper-warm). Shadows reserved for input tactility, button press, and focus.
- The watermark is the universal nav. A 32px corner glyph; click reveals a tooltip menu. The same mark on every surface, with context-specific menu items.
- The cmd-palette is the eventual nav-at-scale (`⌘K`). Watermark tooltip absorbs operator nav until the palette ships.

## 2. Colors

A warm-cool fog palette plus a single ochre accent. Neutrals tilt slightly cool in the dark theme, slightly warm in the light theme — asymmetric on purpose.

### Primary

- **Ochre** (`oklch(64% 0.14 85)` light / `oklch(76% 0.14 85)` dark): the only saturated color. Used for focus rings, link underlines on hover, the code-block leading rule, the watermark glyph stroke, the active-state of toolbar buttons, and the W1 underline-draw under the watermark on hover. ≤ 5% of any surface. Warm mustard hue — distinctly off-tribe from blue-500 / magenta / neon.
- **Ochre Deep** (`oklch(54% 0.16 80)` light / `oklch(82% 0.13 80)` dark): pressed / active states for primary buttons; never used at rest.

### Neutral — light theme

- **Paper** (`oklch(95% 0.008 145)`): page background. Warm fog cream — reads as paper, not screen-white.
- **Paper Warm** (`oklch(92% 0.012 140)`): list rows, code-block ground, list container fill. One tonal step deeper than the page.
- **Ink** (`oklch(24% 0.014 240)`): body text, headings, chrome. Tinted slightly toward cool (a measured offset against the warm bg).
- **Border Day** (`oklch(85% 0.012 140)`): hairline borders, dividers.
- **Muted Day** (`oklch(48% 0.018 200)`): timestamps, slugs, kind tags, footer text, label-mono micro-type.

### Neutral — dark theme (asymmetric, not inverted)

- **Dark Fog** (`oklch(19% 0.014 220)`): page background. Warmer and lighter than zinc-950, slight blue-green tilt.
- **Dark Fog Warm** (`oklch(23% 0.014 220)`): list rows, code-block ground.
- **Ink Warm** (`oklch(92% 0.012 100)`): body text in dark — paper-warm fg, not pure white.
- **Border Night** (`oklch(32% 0.014 220)`): hairline borders.
- **Muted Night** (`oklch(64% 0.018 110)`): same roles as Muted Day, lifted for dark surface.

### Named Rules

**The Watermark Color Rule.** Ochre is the only saturated color. ≤ 5% of any rendered surface. If a design wants color to do work, the answer is type weight + tonal layering, not a second accent.

**The No-Pure-Black-Or-White Rule.** Never `#000`, `#fff`, or anything with chroma 0. Every neutral is tinted toward warm hue 140–220 (cool-warm fog). Paper is the lightest surface; dark-fog is the darkest. The current `--background: #ffffff` and `--foreground: #171717` in `globals.css` are scaffold values to be migrated.

**The Asymmetric Theme Rule.** Light is paper + ink; dark is dark-fog + paper-warm fg. The dark theme is not "invert the light values." Each is its own designed scene with its own hue tilt. Verify dark theme separately at every surface.

## 3. Typography

**Display / Headline / Title / Body / Label / UI Font:** Inter Tight (variable, GitHub) with `ui-sans-serif, system-ui, sans-serif` fallback. Loaded via `next/font/google`.
**Code / Mono Chrome Font:** Geist Mono with `ui-monospace, SFMono-Regular, monospace` fallback. Retained from the v1 scaffold.

**Character.** Single-family sans, weight-driven hierarchy. Inter Tight carries display through body across one variable axis (400 → 700), giving real weight contrast without a second family. Mono is reserved for code blocks and a small set of chrome micro-type roles (slugs, dates, kbd hints) where the receipt-aesthetic ticker-tape feel anchors the design.

The current `Geist Sans` import in `src/app/layout.tsx` is the Vercel-stack scaffold default and should be replaced with Inter Tight as part of the foundation phase. Geist Mono stays.

### Hierarchy

- **Display** (700, `clamp(2rem, 1.5rem + 2vw, 2.5rem)`, line-height 1.12, letter-spacing -0.025em): H1 of a `/v` doc, the page title on the dashboard. Real weight, not a flat scale.
- **Headline** (600, 1.5rem, line-height 1.2, letter-spacing -0.015em): H2s, section dividers in operator chrome.
- **Title** (600, 1rem, line-height 1.3): row labels, button text, form section headers.
- **Body** (400, 1.0625rem, line-height 1.65): article prose, form help text. Capped at 65ch (Reading) or 80ch (Full).
- **Label** (600, 0.6875rem, all-caps, letter-spacing 0.12em): section eyebrows, kind tags, surface stamps. Always uppercase.
- **Mono** (Geist Mono 500, 0.75rem, letter-spacing 0.04em, OpenType `tnum`): slugs, dates, kbd hints, footer micro-type.
- **Code** (Geist Mono 400, 0.875rem, line-height 1.6): inline code and Shiki blocks.

### Named Rules

**The One-Family Rule.** One sans (Inter Tight) carries display through body. Hierarchy is weight + size, never an alternate family. Mono (Geist Mono) is reserved for two roles: code blocks and ticker-tape chrome (slugs, dates, kbd, label-mono).

**The 1.4-Ratio Rule.** Step ratio between hierarchy levels is ≥ 1.25, with display sitting ≥ 1.4 above headline. Flat scales are the boring trap; this prevents them.

**The Tabular-Numerals Rule.** Dates, byte counts, slug fragments — anything that lines up vertically — uses `font-variant-numeric: tabular-nums` via OpenType `tnum`. The dashboard list and view-page footer must align numerically.

## 4. Elevation

Tactile flat. No decorative shadows. Surfaces are flat at rest; depth is tonal (paper vs. paper-warm in light; dark-fog vs. dark-fog-warm in dark). Three narrow exceptions earn shadows: input fields keep a subtle 1px tactile underline, primary buttons gain a press-down on `:active`, and focus rings render the ochre ring as the only color the chrome shows at rest.

### Shadow Vocabulary

- **Tactile-input** (`box-shadow: 0 1px 0 oklch(85% 0.012 140 / 0.6)`): persistent on text inputs and textareas. Reads like a printed underline rather than a drop shadow.
- **Press** (`box-shadow: inset 0 1px 0 oklch(0% 0 0 / 0.08)`): primary buttons on `:active`. Softer than the default browser press.
- **Focus-ring** (`box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--ochre)`): two-step outline (paper offset + ochre ring). Identical for keyboard and mouse focus on every interactive element.
- **Tooltip-soft** (`box-shadow: 0 4px 24px oklch(20% 0.014 240 / 0.10)`): only on the watermark tooltip and the cmd-palette modal — softens the floating layer without breaking the tactile-flat vow.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows are reserved for input tactility, button press, focus, and floating-overlay softness. No decorative ambient shadows under cards. No glassmorphism. The header's backdrop-blur (legacy, will be removed when the watermark replaces SiteHeader) was functional; the watermark itself is solid.

**The Focus-Has-Color Rule.** Focus is the only chrome state where the ochre accent appears at rest. Keyboard users must see the ochre ring on every interactive element they tab to.

## 5. Components

### Watermark glyph

- **Shape:** 32px square, rounded-md (6px), 1px border-day at rest.
- **Content:** the existing md SVG mark (the file-icon glyph from `site-header.tsx`), rendered in ochre stroke at 16px.
- **Hover:** border transitions to ochre. A 2px ochre rule (the W1 underline-draw) animates from 0 → 100% width directly below the glyph (280ms, ease-out-quart). No scale, no bounce. Honors `prefers-reduced-motion`.
- **Click:** opens the tooltip menu (a small popover anchored top-right of the glyph). Click outside or `Esc` closes it.
- **Position:** desktop top-right of each surface, vertically aligned with whatever exists in the surface's existing top-right (search bar in operator, edit-head in editor, H1 cap-line in reader). Mobile: bottom-left.
- **Variants:** `reader`, `operator`, `editor`, `settings`. Each variant renders different tooltip menu rows. The mark itself is identical across variants.

### Watermark tooltip menu

- **Container:** rounded-lg, paper background, border-day, tooltip-soft shadow. 280px min-width.
- **Group structure:** rows separated into named groups (Document / View / Editor / Operator) with a small uppercase label (Label typography) and a hairline rule between groups.
- **Row:** flex layout, label on the left (icon + text), kbd-hint or pill control on the right. Hover row: paper-warm bg.
- **Reader rows:** Document (view raw `r` / copy link `c`) · View (width pill Reading / Full) · md.niftymonkey.dev.
- **Operator rows:** Operator (command palette `⌘K` / settings / all docs) · sign out.
- **Editor rows:** Editing (save `⌘S` / cancel `Esc` / view raw).
- **Settings rows:** command palette / back to dashboard.

### Buttons

- **Shape:** rounded-md (6px). Not pill, not square.
- **Primary:** ink fill, paper text, 9px / 18px padding, Title typography. Hover: ochre-deep bg. Active: press inset shadow + 1px y-translate.
- **Ghost:** transparent fill, ink text, hairline border-day, 6px / 12px padding, Label typography (mono caps). Hover: paper-warm bg.
- **Toolbar (icon-only):** 32px square, rounded-md, border-day, transparent fill, 16px svg icon (muted-day). Hover: border becomes ochre, icon becomes ochre, bg becomes paper-warm. `is-active` state: ochre fill, paper icon, ochre border.
- **Disabled:** opacity 0.4, cursor not-allowed, no hover.

### Inputs

- **Style:** paper-warm bg (not paper, to read as a depressed surface), hairline border-day, rounded-md, 10px / 14px padding, Body typography. Persistent tactile-input shadow at the bottom edge (1px ochre-tinted line).
- **Focus:** focus-ring (paper offset + ochre ring). Border does NOT change color — the ring carries the state.
- **Placeholder:** muted-day at 0.7 opacity. No italic.
- **Markdown textarea:** code typography (Geist Mono, 0.875rem, line-height 1.65). The act of editing markdown reads as editing a code file.

### Lists / dashboard rows

- **Container:** divider-style — no outer container border. Each row is its own self-contained card-like row with paper-warm bg + border-day.
- **Row layout:** grid with title (left, Title typography) + date (right, Mono typography with tabular nums).
- **Hover row:** background unchanged, but the title color shifts from ink to ochre on hover (subtle).
- **No kind label on dashboard rows.** Kind is a database field used by the API and shown only in the edit form, never in chrome.

### Search bar (operator topbar)

- **Layout:** flex row containing a search-icon, the input field, and a `⌘K` kbd indicator on the right.
- **Style:** paper-warm bg, border-day, rounded-lg (8px), 12px / 16px padding.
- **Placeholder:** "Search docs, settings, actions…"
- **Click:** opens the cmd-palette (when implemented).

### Outline panel (reader page)

- **Container:** sticky right-rail at viewport ≥ 1100px, 240px wide, max-height = viewport - 48px, vertical scroll.
- **Header row:** flex row with title "On this page" (Label typography) on the left + reader toolbar (toolbar buttons) on the right. Padding-top 8px to align with H1's cap-height.
- **List:** ordered list of H2 anchors with nested H3s. Each anchor shows hover state (color shift) and `is-current` state (ochre text, weight 600, plus a small ochre dot in the gutter).
- **Auto-show:** on docs with ≥ 3 H2 headings, when the user's "Auto-show outline" preference is on. Per-view toggle persisted in localStorage; Settings master toggle overrides.
- **Hide button:** part of the reader toolbar, lives inside the panel header. Click collapses the outline column; floating "show outline" button at top-right re-opens.
- **Below 1100px:** outline does not auto-show; opens as a bottom sheet via the watermark tooltip.

### Reader toolbar

- **Layout:** flex row, lives inside the outline panel header. Two children: hide button (`Toggle outline`) + watermark.
- **Hide button:** toolbar-button variant. `is-active` when outline is shown; outlined-only when hidden. Icon: 3-line list svg.
- **Watermark:** the universal mark, reader variant tooltip.

### Code block (signature treatment)

- **Container:** rounded-md, paper-warm bg, 2px ochre `border-left` (the leading rule — the one place a left rule is justified, because it's the brand mark on the most-shared content).
- **Padding:** 16px / 20px.
- **Typography:** Geist Mono 0.875rem, line-height 1.6.
- **Syntax:** Shiki-rendered with `github-light` / `github-dark` themes. Token colors are theme-driven, NOT brand-driven — the brand contributes the leading rule + container, never the token colors.
- **Inline `<code>`:** paper-warm bg, ochre text, 1px / 6px padding, rounded-sm. No border.
- **Mermaid diagrams:** centered figure, no caption frame, paper-warm container.

### Cmd-palette modal (deferred to its own ship)

- **Trigger:** `⌘K` from anywhere; click on the operator search bar; watermark tooltip "command palette" row.
- **Container:** centered modal, 560px max-width, paper bg, border-day, rounded-lg, tooltip-soft shadow. Backdrop: black @ 0.45 opacity (light) / 0.6 (dark).
- **Search input:** flex row at top with search icon + input (Body typography, no border, no underline).
- **Result groups:** "Documents" (recent N matches, fuzzy via `pg_trgm`, full-text via `search_vector`) and "Actions" (New document, Open settings, Sign out, etc.). Each group has a Label-typography header.
- **Result row:** grid with icon (left, 24px) + title (1fr) + meta or kbd (right). `is-selected` row: paper-warm bg, ochre 3px left rule (this is a meaningful "you are here" cue for keyboard navigation, not decoration).
- **Footer:** kbd hints (`↑↓ navigate`, `↵ open`, `esc close`).
- **Behavior:** `↑↓` arrow keys navigate selection; `↵` opens; `Esc` closes; click on backdrop closes; honors `prefers-reduced-motion`.

### Settings rows

- **Container:** sectioned page with Label-typography section headers, each followed by a thin ochre rule.
- **Row layout:** grid with label + description (left, two-line) + control (right, switch / pill / input).
- **Switch:** 36px x 20px rounded pill, ochre when on, border-day when off; circle thumb that slides.
- **Pill control:** two-state inline, active state has ochre bg + paper text.
- **Token table:** standard table with name / id-prefix / scope-pill / last-used / revoke-action columns.

## 6. Do's and Don'ts

### Do

- **Do** use Inter Tight across display, headline, title, body, label. Hierarchy comes from weight (400 → 600 → 700) and size, not a second font family.
- **Do** reserve mono (Geist Mono) for code and chrome micro-type (slugs, dates, kbd hints). Tabular numerics on every numeric column via OpenType `tnum`.
- **Do** use OKLCH for every color value. Tint every neutral toward warm hue 140–220. Never `#fff`, `#000`, or zero-chroma neutrals.
- **Do** reserve the ochre accent for: focus rings, link-on-hover, code-block leading rule, watermark glyph, text selection. ≤ 5% of any surface.
- **Do** treat light and dark as separate designed atmospheres. The dark theme is not "invert the light values." Use dark-fog + paper-warm fg, not zinc-950 + zinc-100.
- **Do** make the code block a signature: ochre leading rule, paper-warm ground, careful padding. The most-shared content gets the most craft.
- **Do** vary spacing. The dashboard's list rows are denser than the view page's article body; the view page's article is denser than the upload form. Same padding everywhere is monotony.
- **Do** lead each section with real weight contrast: H1 display (700) sits ≥ 1.4× larger than H2 headline (600). A reader must see the hierarchy at a glance.
- **Do** put `aria-label` on every icon-only button (the watermark glyph, the toolbar buttons, the cmd-palette result icons). Focus-ring must clear all surfaces in both themes.

### Don't

- **Don't** use Inter, Geist Sans (current scaffold), or any Vercel-stack default font. PRODUCT.md flags this as the category reflex.
- **Don't** use zinc-50 / zinc-100 / zinc-900 / zinc-950 in new code. The current `bg-zinc-50` / `dark:bg-zinc-950` in `src/app/layout.tsx` are scaffold; migrate to paper / dark-fog.
- **Don't** use SaaS landing-page tropes: hero metric block, supporting-stat strip, gradient accent, identical card grids, "trusted by" logos, glassmorphism.
- **Don't** use Notion / Medium clone signals: big serif H1, blockquote-heavy stylings, narrow center column with floating capsule chrome.
- **Don't** use over-designed personal portfolio tells: gradient text, scroll-jacking, mouse-trail effects, 3D transforms on hover.
- **Don't** use `border-left` / `border-right` greater than 1px as a colored stripe on lists, callouts, or alerts. The ONE exception is the code-block leading rule (2px ochre on the left edge), because it's the deliberate brand mark on the most-shared content.
- **Don't** wrap interactive hover with `transform: scale()` or bounce/elastic easing. Easing curves are exponential ease-out (quart / quint / expo) and quick (≤ 280ms).
- **Don't** stack cards inside cards. Don't wrap every section in a container. The view page article is just the article.
- **Don't** add a second accent color. If a design wants color to do more work, the answer is type weight + tonal layering, not a second hue.
- **Don't** use em dashes in UI copy or generated chrome. Commas, colons, semicolons, periods, parentheses. Also not `--`.
- **Don't** change a button's *border* on focus. Border colors are static; the focus-ring carries the state.
- **Don't** animate layout properties (`width`, `height`, `top`, `left`). Transform / opacity only.
- **Don't** show a header on the unauthed `/v/<slug>` reader page. The watermark is the only chrome. The current `SiteHeader` linking to `/` is a broken affordance for unauthed readers (lands on a login wall).
- **Don't** show kind in chrome. Kind is a database field used by the API and shown only in the edit form. Never in row chrome, reader chrome, or the unfurl card.
- **Don't** override Shiki syntax token colors with brand colors. Shiki's `github-light` / `github-dark` themes drive code colors. The brand contributes the container chrome (leading rule, background) only.

## 7. Future surfaces

These are surfaces and capabilities specced in the design vision but not implemented in the foundation phase. They land in their own PRs over time. The design system below is structured to absorb each cleanly.

### Cmd-palette (`⌘K`)

The eventual universal nav. Replaces the operator-mode watermark tooltip's nav rows when it ships. Uses the existing `pg_trgm` + `search_vector` indexes. Modal overlay, search-input-led, result-grouped (Documents / Actions). Component spec is in section 5 above.

### Settings page (`/settings`)

Auth-gated route. Sections: Reading (auto-show outline toggle, default width pill) / API tokens (table + create flow) / Defaults (default kind, default indexing) / Account (operator email, sign out). Master toggles wire to runtime behavior — auto-show outline default, default width applied to new sessions, etc.

### Personal API tokens

Replaces static `MD_API_KEY`. New `api_tokens` table with hashed token storage, scope field, last-used tracking, revocation. Settings UI for CRUD. Auth handler abstraction in `src/lib/auth.ts` already supports the swap; this is a one-file change plus a migration.

### Tagging

Multi-value column on `docs` (or normalized join table — design call when issue opens). Edit form chip-input. Dashboard tag filter chips. Distinct from kind (kind = single classification, tags = multi-label). Never visible in reader chrome.

### Per-doc indexing toggle

`indexable boolean` column on `docs`. Reader page metadata respects per-doc value. Edit form switch. Settings master default.

### og:image generation

`opengraph-image.tsx` rendering a 1200×630 PNG with the masthead, title, date, watermark glyph in the brand fonts and palette. Branded chat unfurls.

### Mobile bottom-sheet outline

Below 1100px viewport, the outline opens as a bottom sheet from the mobile watermark tooltip. Sheet pattern, full-width, dismiss-on-backdrop. Same H2/H3 list structure.

### Brand stance for API consumers

md is committed to **Route A (transparent)**: the other application using md via the API gets md's brand on every shared link — the same watermark, the same og:image, the same chrome. Recipients see md, not the other app, even though the other app published the doc. Route B (white-label per API key) is a deferred decision; if revisited, the watermark component takes a brand prop, the og:image template parameterizes, and the palette tokens become per-token. v1 ships Route A.

### Drafts and revisions

Not in scope. Tracked in `vision-backlog.md` as deferred. If implemented, drafts become a kind value or an `is_draft` column; revisions get a `doc_revisions` table with diff rendering in the watermark tooltip's edit menu.
