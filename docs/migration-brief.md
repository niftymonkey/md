# md.niftymonkey.dev — migration brief

The single GitHub Issue body for **"Convert the current implementation to the Watermark · Fog + Ochre vision."**

This is meant to be the issue that drives the redesign PR — distilled from the design vision (`direction-watermark-future.html` + briefs in this folder) into something an implementer (you, Claude, or anyone else) can execute against.

---

## What this issue is

Convert the current `md.niftymonkey.dev` implementation to the Watermark direction with the Fog + Ochre palette, following the design vision shown in `~/dev/niftymonkey/plans/md/direction-watermark-future.html`.

Scope of THIS issue: **only what already exists in the codebase**. Surfaces and features that don't yet have an implementation are tracked separately in `vision-backlog.md` and live in their own issues.

---

## Reference artifacts

These are the canonical references for the redesign. The issue should resolve any ambiguity by deferring to these in this priority order:

1. `plans/md/direction-watermark-future.html` — interactive prototype showing the full integrated vision (open in a browser; toggle dark; click watermarks).
2. `plans/md/direction-watermark.md` — original brief for the Watermark direction (philosophical center, what exists / doesn't on each surface).
3. `plans/md/watermark-palette-compare.html` — Fog+Ochre vs Slate+Teal comparison (Fog+Ochre is the locked pick).
4. `PRODUCT.md` (repo root) — strategic product principles (resist category reflex, content is the product, etc.).
5. `DESIGN.md` (repo root, to be written in phase 0) — locked visual spec.

---

## What's in scope (existing surfaces only)

### A. Foundation tokens

Replace the current `globals.css` + `layout.tsx` font + theme setup with the Fog + Ochre palette and Inter Tight body font:

- Tokens defined in OKLCH: `--paper`, `--paper-warm`, `--ink`, `--ink-warm`, `--border`, `--muted`, `--ochre`, `--ochre-deep`.
- Asymmetric light/dark themes (light = warm fog cream + ink; dark = dark-fog + paper-warm-fg).
- Selection color: ochre @ ~22% opacity globally.
- Geist Sans → Inter Tight via `next/font/google`. Geist Mono retained.
- All existing `bg-zinc-*`, `text-zinc-*`, `border-zinc-*` Tailwind classes throughout the app should be migrated to the new palette tokens (use Tailwind v4 `@theme` extensions or CSS variables).

### B. Watermark component (new)

Create `src/components/watermark.tsx`:

- 32px square corner glyph (use the existing `<svg>` mark from `site-header.tsx`).
- Click toggles a tooltip menu (a small popover anchored to the glyph).
- Hover triggers W1 underline-draw: a 2px ochre rule animates from 0→100% width below the glyph (280ms, ease-out-quart). Honor `prefers-reduced-motion`.
- Click outside → close. `Esc` → close.
- Three variants prop (`reader` | `operator` | `editor` | `settings`) drive the tooltip menu rows:

  | Variant | Tooltip rows |
  |---|---|
  | `reader` | view raw (`r`) · copy link (`c`) · width: Reading/Full pill (`w`) · md.niftymonkey.dev |
  | `operator` | command palette (`⌘K`) · settings · all docs · sign out |
  | `editor` | save (`⌘S`) · cancel (`Esc`) · view raw |
  | `settings` | command palette (`⌘K`) · back to dashboard |

- Desktop position: `position: absolute; top-right` of the surface, vertically aligned with whatever element is in the surface's existing top-right (search bar in operator, edit head in edit, H1 cap-line in reader if no other top element).
- Mobile position: `bottom-left` of the surface.

### C. Reader page conversion (`src/app/v/[slug]/page.tsx`)

The most-visible surface. Drop the current header + footer; the watermark + outline replace them.

- Remove `<SiteHeader />` import and render.
- Remove the `<footer>` block (View raw / md.niftymonkey.dev — those move into the watermark tooltip).
- Add `<Watermark variant="reader" />` rendered inside the article container (top-right placement).
- Add an outline panel: client component that auto-shows on docs with ≥ 3 H2 headings, sticky right-rail at viewport ≥ 1100px. Honors localStorage for visibility preference + Settings master toggle (Settings UI lives in a separate phase; default the master toggle to `true` for now).
- Outline panel has its own header row containing the title "On this page" (left) + a hide button + the watermark (right).
- A floating "show outline" button at top-right of the surface appears when the outline is collapsed.
- Mount the markdown article inside a width-controllable container (Reading 65ch / Full 80ch+).
- Wire the four reader keyboard shortcuts (`r`, `c`, `o`, `w`) — only when no input is focused and no overlay is open.
- Accept `?raw=1` query param: when present, return the raw markdown as `text/markdown` (or render it in a plain `<pre>` if you prefer — the `/api/raw/<slug>` endpoint already exists; just route to it).

### D. Operator home (`src/app/page.tsx`)

Layout refactor:

- Top row: search bar (placeholder "Search docs, settings, actions…", `⌘K` kbd indicator on the right) + watermark, both inside a flex container.
  - Clicking the search bar opens the cmd-palette (cmd-palette landing in a separate issue, but stub a no-op handler now).
- Below: dropzone (existing `UploadForm` logic — refactor visually, not behaviorally) + textarea + file picker.
- Below that: recent docs rail. Title + date only — **remove the kind label from each row** (kind stays editable in the edit form, used by the API).
- Mount `<Watermark variant="operator" />` in the top row.

### E. Edit form (`src/app/edit/[slug]/page.tsx` + `src/components/edit-form.tsx`)

- Slim layout: title input (large, top-left) + kind input (small, top-right) + watermark (top-right corner, aligned with the head row).
- Existing kind placeholder text: keep as `KIND (optional)` (uppercase, mono, ochre).
- Below: the textarea (existing behavior).
- Save button removed from view; `⌘ + S` shortcut saves; `Esc` cancels with confirmation if dirty.
- Mount `<Watermark variant="editor" />`.
- **Tags input + indexing toggle are NOT in scope of this issue** — they need DB schema changes (see `vision-backlog.md` E1, TG1, I1). This issue keeps the form at title + kind + textarea.

### F. SiteHeader removal

The current `src/components/site-header.tsx` remains for any pre-redesign surface that hasn't migrated yet, but the goal is full removal. The watermark replaces it everywhere.

- After all surfaces in this issue are converted, delete `site-header.tsx`.
- If any surface still imports it, that surface is missing from the migration — flag in PR review.

### G. Theme handling

- No theme toggle UI. `prefers-color-scheme` drives light/dark.
- Verify both themes work end-to-end: reader, operator, edit, view-raw fallback, sign-in pages.

### H. Mermaid + Shiki + GFM rendering

- Existing renderer pipeline is preserved. The only change: container chrome (the figure wrapper around code blocks) gets the new ochre leading rule + paper-warm background.
- Custom selection color is global, so it applies to code as well.

---

## What's explicitly OUT of scope of this issue

These are tracked in `vision-backlog.md` and need their own issues:

- **Cmd-palette overlay** (search + actions) — needs its own implementation issue.
- **Settings page** (`/settings` route + token mgmt + reading prefs + defaults).
- **Personal API tokens** (DB schema, hashed storage, scopes, last-used tracking, CRUD endpoints).
- **Tagging system** (DB column, API, chip-input UI, dashboard filters).
- **Per-doc indexing toggle** (DB column, edit form toggle, default in Settings).
- **og:image generation** (`opengraph-image.tsx`, `next/og`, branded card).
- **Mobile reader bottom-sheet outline** (M1).

The current issue should NOT block on any of these; they ship independently. Hooks and stubs are allowed where it makes the redesign cleanly absorb them later.

---

## Acceptance criteria (high-level outcomes)

- [ ] Visiting any `/v/<slug>` link as an unauthed reader: see the doc, no header, no footer, just the watermark glyph in the top-right corner. Clicking the glyph reveals the tooltip menu.
- [ ] On long docs (≥ 3 H2 headings), the outline panel is visible at right; clicking the hide button collapses it; the show button at top-right re-opens it.
- [ ] Width toggle in the watermark tooltip swaps the article column max-width.
- [ ] `r` / `c` / `o` / `w` keyboard shortcuts work on the reader page.
- [ ] `?raw=1` returns the raw markdown.
- [ ] The operator dashboard at `/` shows the search bar + watermark in a top row, with the dropzone below and a clean recent-docs rail (no kind labels in row chrome).
- [ ] The edit form is a slim two-row layout (title/kind, textarea) with the watermark for save/cancel/raw.
- [ ] No `bg-zinc-*` / `text-zinc-*` / Geist Sans references remain.
- [ ] Light and dark themes both render correctly across all surfaces.
- [ ] Mermaid and Shiki rendering verified intact under the new tokens.
- [ ] No regressions in: upload (UI + API), delete, view-raw API endpoint, edit (PATCH), email allow-list gate, WorkOS auth.
- [ ] PR includes screenshots of: reader desktop light + dark, reader mobile light + dark, operator home light + dark, edit form light + dark.

---

## Phase ordering inside the PR

One feature branch (`feat/watermark-redesign`), one PR, but commits should follow this order so each commit is reviewable:

1. **Foundation:** `globals.css` tokens + `layout.tsx` font swap. App still works with old layouts; just the colors and fonts shift.
2. **Watermark component:** new `watermark.tsx`, three variants, tested in isolation.
3. **Reader page:** convert `/v/[slug]`, mount watermark, add outline + width toggle + keyboard shortcuts + `?raw=1`.
4. **Operator home:** convert `/`, top flex row, dropzone-led, kind removed from row chrome.
5. **Edit form:** convert `/edit/[slug]`, slim layout, watermark.
6. **Cleanup:** remove `SiteHeader` from any remaining surfaces; delete the file. Verify no Geist Sans or zinc references remain.

---

## Notes for the implementer

- The interactive prototype is the source of truth for visual decisions. When CSS feels ambiguous, copy the rule from the prototype.
- The prototype uses prefixed class names (`ds-` style) and inline styles — production code should use Tailwind v4 utility classes + `@theme` extensions for the tokens. Don't lift CSS verbatim; translate to the project's conventions.
- Watermark tooltip rendering can use a tiny in-house popover — no need for `@radix-ui` unless you already use it. Click-outside + `Esc` are the only behaviors.
- Outline scroll-spy: `IntersectionObserver` on `h2`, `h3` elements within the article container. Element with the smallest positive `boundingClientRect.top` is the active one.
- Width toggle uses `localStorage`; key `md.width` with values `"reading"` | `"full"`. Default `"reading"`.
- Outline visibility: `localStorage` key `md.outline.shown` with `"true"` | `"false"`. Default depends on doc's H2 count + Settings master toggle (assume master = true for this PR; Settings page lands later).
