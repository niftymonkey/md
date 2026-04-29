# md.niftymonkey.dev — vision backlog

A list of every feature, surface, and capability surfaced during the design vision (`direction-watermark-future.html` and the briefs in this folder) that is **not yet implemented** in the current codebase.

Each entry is shaped to become a GitHub Issue. Cross-reference with the existing project board; anything here that already has an issue can be linked, anything missing can be drafted using the entry below as the body.

The entries are grouped by capability, not strict ship order. Phase ordering is in the migration brief (`migration-brief.md`).

---

## Foundation

### F1. Migrate globals.css tokens to fog-and-ochre OKLCH palette

**Why:** PRODUCT.md principle 2 (resist category reflex) flags the current `bg-zinc-50 / bg-zinc-950 / Geist / accent-blue-by-default` as the Vercel-stack reflex. The new palette commits to warm-cool fog neutrals + ochre accent, expressed in OKLCH.

**Acceptance criteria:**
- [ ] `src/app/globals.css` defines the fog-and-ochre palette tokens (paper / paper-warm / ink / muted / border / ochre / ochre-deep) as CSS custom properties in OKLCH.
- [ ] Light and dark themes are asymmetric (not inverted): light is fog-cream + ink, dark is dark-fog + paper-warm-fg.
- [ ] Selection color uses ochre @ ~22% opacity in both themes.
- [ ] No usage of `#fff`, `#000`, `#0a0a0a`, or zero-chroma neutrals anywhere.
- [ ] `prefers-color-scheme` continues to drive theme selection (no manual toggle).

**Dependencies:** none.

**Reference:** `direction-watermark.md`, `direction-watermark-future.html` `:root` blocks.

---

### F2. Swap Geist Sans → Inter Tight; keep Geist Mono

**Why:** Geist Sans is the Vercel-stack default font. The category-reflex anti-reference applies. Inter Tight is competent, free, has weight range. Mono category-reflex is weaker and Geist Mono is fine.

**Acceptance criteria:**
- [ ] `src/app/layout.tsx` imports Inter Tight (Google Fonts via `next/font/google`) and exposes `--font-sans`.
- [ ] Geist Sans import removed.
- [ ] Geist Mono retained for code blocks, slugs, dates, kbd hints.
- [ ] Body sets `font-family: var(--font-sans), system-ui, sans-serif`.

**Dependencies:** F1 (tokens) recommended first; not strict.

---

## Reader page (`/v/[slug]`)

### R1. Watermark component (universal corner glyph + tooltip menu)

**Why:** The Watermark IS the brand mark and the universal nav. PRODUCT.md is built around md being a "printer's mark" — small, persistent, click-to-reveal. Replaces the existing `SiteHeader` on reader surfaces and lives on every authenticated surface.

**Acceptance criteria:**
- [ ] New component `src/components/watermark.tsx` renders a 32px corner glyph (the existing SVG mark from `site-header.tsx` is fine).
- [ ] Click toggles a tooltip menu of contextual rows.
- [ ] On hover, a 2px ochre rule animates from 0→100% width below the glyph (W1 underline-draw, 280ms ease-out-quart). No scale, no bounce.
- [ ] Honors `prefers-reduced-motion` (instant rule appearance, no transition).
- [ ] Click-outside dismisses the tooltip.
- [ ] `Esc` dismisses the tooltip.
- [ ] Three context variants: `reader`, `operator`, `editor` — different tooltip menu rows per variant.
- [ ] Desktop position: `top-right` of the surface chrome (per surface, varies by surface — see migration brief for specifics).
- [ ] Mobile position: `bottom-left`.
- [ ] Keyboard-navigable.

**Dependencies:** F1, F2.

**Reference:** `direction-watermark-future.html` `.watermark`, `.wm-tooltip`, `.wm-row` styles.

---

### R2. Outline panel + auto-show + reader toolbar (hide button) + floating show button

**Why:** Long docs are unnavigable without a TOC. The outline auto-shows on docs with ≥3 H2 headings (overridable via Settings + per-view toggle). The hide button lives inside the outline's header row alongside the watermark; a separate floating "show outline" button appears at top-right when the panel is collapsed.

**Acceptance criteria:**
- [ ] On docs with ≥3 H2 headings, outline panel is shown by default on viewports ≥1100px.
- [ ] Outline shows H2s and nested H3s as a list of anchor links.
- [ ] Active section is highlighted (ochre text + 600 weight + a small ochre dot in the gutter; **no left-stripe border**).
- [ ] Active section detected via IntersectionObserver as the user scrolls.
- [ ] Clicking a link scrolls to the heading (smooth scroll; instant for `prefers-reduced-motion`).
- [ ] Outline panel header row contains the title "On this page" (left) and a toolbar (right) with a hide button + the watermark.
- [ ] Hide button collapses the outline column; floating show button at top-right of surface re-opens.
- [ ] Outline visibility preference persists in localStorage per user.
- [ ] Settings page has master toggle for "Auto-show outline" — when off, outline never auto-shows; user must explicitly open it.
- [ ] Below 1100px viewport, outline does not auto-show; opens as a sheet via watermark tooltip (mobile pattern).
- [ ] Outline panel uses `position: sticky` with viewport-height max so it tracks scroll.

**Dependencies:** R1 (watermark), F1, F2, S1 (settings page hosts the master toggle).

**Reference:** `direction-watermark-future.html` `.outline`, `.outline__head`, `.outline__list`, `.reader-show-outline`, JS `setOutlineHidden`.

---

### R3. Width toggle (Reading / Full)

**Why:** Some doc content (wide tables, mermaid diagrams, long code lines) wants more horizontal room than the 65ch reading column. Width toggle lets the reader choose without leaving the page.

**Acceptance criteria:**
- [ ] Watermark tooltip on reader pages includes a "Width" row with a two-state pill: `Reading` / `Full`.
- [ ] Reading mode: article max-width 65ch (~720px).
- [ ] Full mode: article max-width 1280px (or surface width minus margins).
- [ ] Toggle persists in localStorage per user (single global preference, not per-doc).
- [ ] CSS transition on the article max-width on toggle (`cubic-bezier(0.25,1,0.5,1)` 220ms).
- [ ] Settings page has a "Default width" pill control to set the persisted value.
- [ ] `w` keyboard shortcut on the reader page toggles width.

**Dependencies:** R1 (watermark tooltip), S1 (settings).

---

### R4. Reader keyboard shortcuts (r / c / o / w)

**Why:** Power users (the operator + technical recipients) get instant access to common actions without opening the watermark tooltip.

**Acceptance criteria:**
- [ ] On `/v/[slug]` pages, keyboard shortcuts are active when no input is focused and no overlay is open:
  - `r` → switch to raw view (`?raw=1`)
  - `c` → copy current link to clipboard, flash a hint
  - `o` → toggle outline visibility
  - `w` → toggle width Reading / Full
- [ ] A small hint flash ("link copied", "outline hidden", etc.) appears bottom-center for ~1.4s after each shortcut.
- [ ] Shortcuts disabled when text inputs / textareas are focused.
- [ ] `Esc` always closes the cmd-palette + watermark tooltip.

**Dependencies:** R1, R2, R3, R5.

---

### R5. `?raw=1` query parameter handling on reader page

**Why:** Devs and agents sharing md links sometimes want the raw markdown back, not the rendered HTML. Currently they have to navigate to `/api/raw/<slug>` separately. `?raw=1` on the same URL gives them the raw without leaving the page context.

**Acceptance criteria:**
- [ ] `/v/<slug>?raw=1` returns `text/markdown` (same content as `/api/raw/<slug>`).
- [ ] Watermark tooltip "view raw" row links to `?raw=1`.
- [ ] `r` keyboard shortcut navigates to `?raw=1`.
- [ ] Shareable: copying a `?raw=1` URL and pasting it preserves the raw view.

**Dependencies:** R1, R4.

---

### R6. Custom selection color + code-block leading rule

**Why:** Selection color + a 2px ochre leading rule on code blocks are the two places ochre touches the otherwise-restrained reader page. Recipients quoting the doc end up with ochre-tinted screenshots — small recognition-of-md moment.

**Acceptance criteria:**
- [ ] Global `::selection` rule paints text-bg in ochre @ ~22% opacity, preserving text color.
- [ ] Code blocks rendered by Shiki get a 2px ochre `border-left` and a paper-warm background.
- [ ] Inline `<code>` retains paper-warm bg with ochre text color.
- [ ] Shiki syntax token colors are NOT overridden — `github-light` and `github-dark` themes drive code colors independently of brand palette.

**Dependencies:** F1.

---

### R7. Remove `SiteHeader` from reader page; reader is doc-only chrome

**Why:** The current header has an "md" wordmark linking to `/` — for unauthed readers this links to a login wall. Plus PRODUCT.md says reader chrome budget is ~2% (just the watermark). The site-header is a relic of the operator-and-reader-share-chrome design.

**Acceptance criteria:**
- [ ] `src/app/v/[slug]/page.tsx` no longer renders `<SiteHeader />`.
- [ ] The current footer (`<footer>` with "View raw" + "md.niftymonkey.dev") is removed (those actions move into the watermark tooltip).
- [ ] Reader page renders: `<Watermark variant="reader">` + `<MarkdownRenderer />` and that's it.
- [ ] Operator surfaces continue to use `<SiteHeader />` until R8 removes it from those too (if applicable).

**Dependencies:** R1.

---

## Operator home (`/`)

### O1. Operator topbar — search bar + watermark in a flex row

**Why:** The doc list will eventually grow past quick-scan size. A search bar at the top is the primary nav. The watermark sits inline with it, composing one toolbar row at the surface top.

**Acceptance criteria:**
- [ ] `/` page has a top flex row containing a search bar and the watermark (operator variant).
- [ ] Search bar is full-width minus the watermark; placeholder "Search docs, settings, actions…"; shows `⌘K` kbd indicator on the right.
- [ ] Clicking the search bar opens the cmd-palette (C1).
- [ ] Watermark tooltip in operator mode contains: command palette (`⌘K`) / settings / all docs / sign out.

**Dependencies:** R1, C1.

---

### O2. Dropzone-led upload surface

**Why:** The operator's job at `/` is "upload markdown, get URL." The upload affordance should dominate the page. Current `UploadForm` works; this is a layout refactor + visual polish, not new logic.

**Acceptance criteria:**
- [ ] Dropzone is the main visual element of `/` — large, dashed border, "Drop a markdown file here" hint.
- [ ] Below the dropzone (or inline): paste textarea / file picker (existing logic).
- [ ] `⌘ + Enter` submits the textarea content.
- [ ] On success, the existing toast renders the URL with copy + view actions (existing behavior).
- [ ] No "kind" UI in chrome (remove the current "Kind (optional, e.g. note, rep, synthesis)" placeholder text from the top-level form). Kind stays as an editable field on the edit form (E1).

**Dependencies:** F1, F2.

---

### O3. Recent docs rail (no kind chrome)

**Why:** A compact "recent uploads" list below the dropzone. Title + date only; kind removed from the row chrome per design decision (kind stays editable in the form, used by the API).

**Acceptance criteria:**
- [ ] Below the dropzone: 8 most-recent docs as a list of rows.
- [ ] Each row: title (semibold) + date (mono, oldstyle figures).
- [ ] No kind chip/label in the row.
- [ ] Hover row: paper-warm background.
- [ ] "all docs →" link at the bottom for paginated browsing (links to `/all` or via cmd-palette once search ships).

**Dependencies:** F1.

---

## Edit form (`/edit/[slug]`)

### E1. Slim edit form with title + kind + tags + indexing toggle + textarea

**Why:** The current form has title + kind + textarea + Save/Cancel. The new form adds tags (chip-input) + per-doc indexing toggle, all in one tight row above the textarea.

**Acceptance criteria:**
- [ ] Top row: title input (large, transparent border) + kind input (small, optional, mono caps) + watermark.
- [ ] Second row: tags chip-input + per-doc indexing toggle.
- [ ] Tags chip-input: type-and-Enter to add a chip; backspace removes; chips have ochre border + ochre text.
- [ ] Indexing toggle: small switch + label "Allow search engines"; default off (current site-wide noindex is the default).
- [ ] Below: full-width mono textarea (existing).
- [ ] Watermark tooltip in edit mode: save (`⌘S`) / cancel (`Esc`) / view raw.
- [ ] `⌘ + S` saves; `Esc` cancels with confirmation if dirty.

**Dependencies:** R1, T1 (tagging schema), I1 (indexing column).

---

## Cmd-palette

### C1. Cmd-palette modal with `⌘K` / `Ctrl+K` open + recent docs + actions

**Why:** Once Settings + Search + token mgmt + all-docs all want input affordance, the watermark tooltip overflows. Cmd-palette is the absorption surface — Linear/Raycast pattern. Opens from anywhere.

**Acceptance criteria:**
- [ ] `⌘K` (or `Ctrl+K`) from any operator surface opens the palette modal.
- [ ] Clicking the search bar on `/` opens the same palette.
- [ ] Watermark tooltip "command palette" row opens it.
- [ ] Modal: search input at top, results list below, footer with kbd hints (↑↓ navigate, ↵ open, Esc close).
- [ ] Result groups: "Documents" (recent N), "Actions" (New document, Open settings, Sign out, Copy current link, Toggle theme).
- [ ] Live filter as the user types — fuzzy match against title via existing `pg_trgm` index, full-text via `search_vector`.
- [ ] Arrow keys navigate selection; `↵` opens; `Esc` closes; click backdrop closes.
- [ ] Persisted state: last-used filters (if any) survive close + reopen.
- [ ] Honors `prefers-reduced-motion` (no fade animation; just appears/disappears).

**Dependencies:** F1, F2, search wired to existing FTS infrastructure.

---

## Settings page

### S1. `/settings` route — Reading + API tokens + Defaults + Account

**Why:** Personal API tokens (replacing static `MD_API_KEY`) need a home. So do reading prefs (auto-show outline, default width) and per-doc defaults (default kind, default indexing). Account info (signed-in operator + sign out) consolidates here.

**Acceptance criteria:**
- [ ] New route `src/app/settings/page.tsx`, auth-gated.
- [ ] Sectioned page with Inter Tight section headers + thin ochre rule under each:
  - **Reading** — auto-show outline (toggle); default width (Reading/Full pill).
  - **API tokens** — table of tokens (name, ID prefix, scope chip, last-used, revoke action); "Create new token" button → modal flow (T2).
  - **Defaults** — default kind input; default indexing toggle.
  - **Account** — operator email; "Sign out" button.
- [ ] Watermark in settings variant — tooltip rows: command palette / back to dashboard.
- [ ] Watermark right-edge aligns with content right-edge (matches surface horizontal padding).
- [ ] All toggles + pills persist values to a per-user preferences store (DB column on `users` or a new `user_preferences` table).

**Dependencies:** R1, T2 (token CRUD), I1 (indexing column), DB schema for user preferences.

---

### S2. Settings master toggles wire to runtime behavior

**Why:** The Settings toggles aren't decorative — they actually control reader/operator behavior.

**Acceptance criteria:**
- [ ] "Auto-show outline" off → outline never auto-shows on `/v/[slug]` pages; user must explicitly open via watermark.
- [ ] "Default width" preference applies to new doc views (existing localStorage-per-doc still wins for current session).
- [ ] "Default kind" pre-fills the kind field on `/` and `/edit/[slug]`.
- [ ] "Default indexing" sets the per-doc indexing default for new uploads.

**Dependencies:** S1.

---

## Personal API tokens

### T1. Tokens DB schema + auth handler swap

**Why:** Currently `MD_API_KEY` is a single env-var token. This blocks revocation, scoping, and tracking. Personal tokens (multiple per operator, hashed, scoped, revocable) replace it. plan.md flags this as deferred but pre-decided.

**Acceptance criteria:**
- [ ] New table `api_tokens`: `id uuid PK`, `owner_id text NOT NULL`, `name text`, `token_hash text NOT NULL UNIQUE`, `prefix text NOT NULL` (first 8 chars for display), `scope text` (`upload` | `upload,read` | future), `last_used_at timestamptz`, `created_at`, `revoked_at`.
- [ ] `requireApiAuth(req)` (existing in `src/lib/auth.ts`) checks the bearer against `api_tokens` (hashed comparison) before falling back to env `MD_API_KEY` (kept for one release as transition).
- [ ] On valid token, `last_used_at` is updated (best-effort; non-blocking).
- [ ] Revoked tokens (`revoked_at IS NOT NULL`) reject as 401.
- [ ] Static `MD_API_KEY` env var is deprecated — if both new tokens AND env match, new tokens win.

**Dependencies:** none (foundation for T2 + S1).

---

### T2. Token CRUD endpoints + Settings UI

**Why:** Operators need to create, name, scope, and revoke tokens via the UI.

**Acceptance criteria:**
- [ ] `POST /api/tokens` — creates a token, returns the plaintext token ONCE (in response body); subsequent reads only return the prefix.
- [ ] `GET /api/tokens` — lists tokens (without plaintext).
- [ ] `DELETE /api/tokens/[id]` — sets `revoked_at`.
- [ ] Settings page Tokens section renders the list, with revoke action and "Create new token" button.
- [ ] Create flow: modal asks for name + scope, on submit shows the plaintext token ONCE with a copy button + a "save this somewhere — you won't see it again" warning.

**Dependencies:** T1, S1.

---

## Tagging system

### TG1. Tags schema + API

**Why:** You said tagging is on the roadmap, distinct from kind (kind = single classification, tags = multi-label). DB and API support tags as a multi-value column.

**Acceptance criteria:**
- [ ] DB: add `tags text[] NOT NULL DEFAULT '{}'` column on `docs` (or normalize via a join table — design call when issue is opened).
- [ ] GIN index on tags for filter queries.
- [ ] `POST /api/upload` accepts `tags` array in JSON body.
- [ ] `PATCH /api/docs/[slug]` accepts `tags` (replaces full array).
- [ ] `GET /api/list?tag=foo` filters to docs carrying that tag.
- [ ] Listing function (`listDocs`) accepts a `tags?: string[]` filter.

**Dependencies:** none structurally; UI lands in E1 + O4.

---

### TG2. Tag chip-input on edit form (visual UI)

**Why:** Operator-side UI for tags. Lives only in edit form per design discipline.

**Acceptance criteria:**
- [ ] Edit form (`/edit/[slug]`) has a chip-input row labeled "Tags".
- [ ] Existing tags appear as removable ochre-bordered chips.
- [ ] Type-and-Enter or comma adds a chip.
- [ ] Backspace at empty input removes the last chip.
- [ ] Submitting the form persists the tags array via `PATCH /api/docs/[slug]`.

**Dependencies:** TG1, E1.

---

### TG3. Tag filter chips on operator dashboard (deferred but specced)

**Why:** Once docs accumulate, filtering by tag becomes useful. Lives above the recent rail on `/`.

**Acceptance criteria:**
- [ ] Above the recent rail on `/`: a horizontal pill row showing existing tags (sorted by usage descending, with "All" as the default-active chip).
- [ ] Clicking a chip filters the recent rail to docs carrying that tag.
- [ ] Filter state persists in URL (`?tag=foo`) so the URL is shareable / bookmarkable.

**Dependencies:** TG1, O3.

---

## Per-doc indexing

### I1. Indexing column + reader page metadata respects it

**Why:** Currently every doc is `noindex, nofollow`. Some docs you'd want to be Google-indexable. Per-doc toggle + Settings default.

**Acceptance criteria:**
- [ ] DB: add `indexable boolean NOT NULL DEFAULT false` column on `docs`.
- [ ] `/v/[slug]` `generateMetadata` checks the doc's `indexable` and emits `robots: { index: <value>, follow: <value> }` accordingly.
- [ ] Edit form has an "Allow search engines" toggle (E1) bound to this column.
- [ ] Upload API + PATCH API both accept `indexable` (defaults to user's Settings default; falls back to `false`).
- [ ] Settings has a "Default indexing" toggle (default off).

**Dependencies:** S1, S2.

---

## og:image generation

### OG1. Branded `opengraph-image.tsx` for `/v/[slug]`

**Why:** Currently every shared link gets a plain text unfurl. With the brand finally locked, every shared link can carry a fog-and-ochre branded card with the title, date, and watermark glyph. Plan.md flags this as deferred.

**Acceptance criteria:**
- [ ] New file `src/app/v/[slug]/opengraph-image.tsx` using Next.js `next/og` API.
- [ ] Renders a 1200×630 PNG with: top-left "MD · NIFTYMONKEY.DEV" mast (caps, ochre); top-right watermark glyph; large doc title in Inter Tight 700; bottom-left date in JetBrains Mono.
- [ ] Falls back gracefully if title is empty (uses "Untitled").
- [ ] Cached at the edge (Next.js handles this by default with the `next/og` API).
- [ ] Verified renders correctly when shared in Slack, Discord, Twitter, iMessage.

**Dependencies:** F1, F2 (so the rendered image uses the brand fonts/colors).

---

## Mobile

### M1. Mobile reader watermark — bottom-left fixed position + bottom-sheet outline

**Why:** Phone users get the watermark in their thumb's reach. Outline opens as a sheet from the bottom rather than as a sidebar.

**Acceptance criteria:**
- [ ] On viewports < 768px (or however Tailwind v4 defines mobile), the watermark renders at `bottom-left` instead of `top-right`.
- [ ] Tooltip menu adapts to small screens (full-width sheet from bottom rather than 280px popover).
- [ ] Outline option in tooltip opens as a bottom sheet showing the H2/H3 list.
- [ ] All keyboard shortcuts still work where applicable; tap-to-toggle replaces hover where needed.

**Dependencies:** R1, R2.

---

## Out-of-vision but worth tracking

### Z1. White-label / multi-tenant brand stance

**Why:** You said API consumer (the other app) takes Route A — md stays md-branded everywhere; the other app shares md links transparently. White-label (Route B) is a deferred decision. Worth a ticket so it's not forgotten.

**Acceptance criteria:**
- [ ] Document in DESIGN.md that v1 commits to Route A.
- [ ] If/when Route B is needed, it requires: per-token brand profile (color, glyph, fonts), `<Watermark brand={...}>` component takes a prop, og:image template parameterized.
- [ ] Tracking issue created so the decision is reopenable later.

**Dependencies:** none.

---

### Z2. Drafts + revisions (deferred)

**Why:** Plan.md says revisions deferred until "restore prior version" is a real need. Drafts not yet on roadmap. Tracking only.

**Acceptance criteria:** none yet — placeholder for future scoping.

---

## Cross-cutting

### X1. Asymmetric dark theme (not inverted)

**Why:** PRODUCT.md design principle 3 — both themes get equal craft, not "invert the light values." The fog-and-ochre tokens already encode this, but verify per surface.

**Acceptance criteria:**
- [ ] Dark mode reader page uses dark-fog bg (`oklch(19% 0.014 220)`) + paper-warm fg, not zinc-950 + zinc-100.
- [ ] All surfaces (operator, settings, edit) verified against asymmetric dark.
- [ ] Code blocks render Shiki `github-dark` (existing) under dark theme — confirmed legible against dark-fog bg.

**Dependencies:** F1.

---

### X2. Click-outside dismiss + Esc handler global wiring

**Why:** Watermark tooltips, cmd-palette, settings modals all need consistent dismiss behavior.

**Acceptance criteria:**
- [ ] Click-outside any open watermark tooltip closes it.
- [ ] `Esc` closes any open watermark tooltip and the cmd-palette.
- [ ] Only one watermark tooltip can be open at a time.
- [ ] Cmd-palette modal click-on-backdrop closes it.

**Dependencies:** R1, C1.

---

## How to use this list

1. Cross-reference each entry's title against existing GitHub Issues in the project board.
2. Items with no matching issue → use the entry body to draft a new issue (acceptance criteria are already shaped; adjust phrasing to match your issue style).
3. Items with a matching issue → link the issue here for traceability and verify the acceptance criteria are still aligned.
4. The migration brief (`migration-brief.md`) groups these entries into shippable phases so the work has a clear order.
