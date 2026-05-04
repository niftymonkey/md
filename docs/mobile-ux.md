# Mobile UX — design decisions

Companion to `docs/cmd-palette-and-discoverability.md` and the post-#37
architecture map. This doc captures the locked decisions for bringing
the mobile experience to parity with the desktop redesign that shipped
in #36 / #37 / #38.

## Problem

The desktop redesign settled on a tight three-tool nav system: cmd
palette (find / global verbs), thin contextual toolbar (per-surface
click affordances + tooltip-advertised hotkeys), and `?` cheat-sheet
(hotkey learning). Mobile broke during that redesign because two of
the three legs are keyboard-bound:

- **Reader toolbar is `sm:`-gated** (`reader-shell.tsx:208`), invisible
  below 640px. Outline toggle, width pill, edit, copy, raw, and
  back-to-dashboard all disappear on phones — for both authed and
  unauth viewers.
- **Cmd palette has no tap target.** Opens via `Cmd/Ctrl+K`, the
  `md:cmd-palette:open` event, or the programmatic `openCmdPalette()`.
  The dashboard's `press ⌘K to navigate` chip is decorative, not a
  button. On a phone, the palette is unreachable.
- **Cheat-sheet (`?`) is unreachable and moot** on touch — no hotkeys
  to learn.

Net: on mobile, a logged-in user can scroll, tap into a doc, and tap
the dashboard's `New document` link. Nothing else. An unauth viewer of
a shared link can only scroll.

## Target users

- **Authed user on phone** (`<768px`). Reading docs they own, jumping
  between docs, occasionally editing on the go. Primary case.
- **Authed user on portrait tablet** (~768px held one-handed). Same
  usage as phone, just larger screen.
- **Unauth viewer on phone**. Following a shared link from chat / email.
  Reads, maybe copies the link to share onward, maybe views raw.
- **Authed user on landscape tablet / desktop** (`≥768px`). Untouched
  by this work.

## Core requirements

### Must-have

- Cmd palette must have a tap-driven entry point on every authed mobile
  surface.
- Reader contextual actions (edit, copy link, view raw, back to
  dashboard) must be tap-reachable on `/v/[slug]` at `<768px`. Authed
  variant gets all four; unauth gets copy + raw.
- New document must be reachable from any authed surface on mobile.
- All existing desktop behavior (`≥768px`) is preserved unchanged.
- Touch targets meet a touch-comfortable floor (≥40px effective hit area).

### Nice-to-have

- Bar hides on scroll-down, reappears on scroll-up — matches iOS Safari
  URL bar pattern, gives long-form reading the full viewport.
- Desktop toolbar hit targets bumped from `size-8` (32px) → `size-9` (36px)
  to soften the trackpad-and-touch hybrid case (Surface, iPad +
  Magic Keyboard).

### Out of scope

- Hotkey cheat-sheet on mobile. Hidden entirely at `<768px`.
- Width pill (R/W) and outline toggle in the mobile bar — viewport-incompatible
  (article fills viewport regardless; outline aside renders only `≥1100px`).
  Both remain on `/settings` Reading section as the canonical preference UI
  and reappear on desktop where they affect the visible page.
- The `press ⌘K` chip on the dashboard — hidden `<md:`, no keyboard.
- A redesign of the cmd palette or hotkey vocabulary beyond the single
  `New document` Actions addition.

## Key decisions

1. **Breakpoint: Tailwind `md:` (768px).**
   `<768px` gets the mobile shell. `≥768px` keeps the desktop shell.
   Phones and portrait tablets get touch-first chrome; landscape
   tablets and laptops keep the existing thin vertical toolbar +
   keyboard-first nav.

2. **Mobile chrome shape: bottom-sticky bar, `<md:` only, hide-on-scroll-down.**
   A single bar pinned to the bottom of the viewport on mobile
   surfaces. Hides while the user scrolls down through content;
   reappears on any scroll-up. Above `env(safe-area-inset-bottom)` to
   avoid the iOS home-indicator gesture area. No top header. No FAB.
   No floating action button anywhere.

3. **Bar structure mirrors the palette's "same shape on every page"
   doctrine.** Two sections, every route:
   - **Global section (left):** `[⌕]` palette-open. Identical on every
     authed route.
   - **Contextual section (right):** per-surface verbs that change
     something visible at this viewport. If the affordance is
     meaningless on mobile (e.g. width pill, outline toggle), it does
     not earn a slot.

4. **Per-route bar contents:**

   | Route | Global | Contextual |
   |---|---|---|
   | `/` (dashboard, authed) | `[⌕]` | `[+ new]` |
   | `/v/[slug]` (reader, authed) | `[⌕]` | `[edit]` `[copy]` `[raw]` `[← dashboard]` |
   | `/v/[slug]` (reader, unauth) | — | `[copy]` `[raw]` |
   | `/edit/[slug]` | `[⌕]` | `[view]` `[cancel]` `[save]` |
   | `/settings` | `[⌕]` | `[← dashboard]` |
   | `/new` | `[⌕]` | `[← dashboard]` |

   The unauth reader bar has no palette section because the palette
   itself is authed-only (`showPalette = isAuthorized` in `layout.tsx:40`).

5. **Cmd palette gains `New document` in the Actions section on every
   viewport.** Same editorial test the palette already applied to
   `Sign out`: a global verb that is useful from anywhere, with no
   faster path on at least one surface. On mobile it is the only fast
   path to `/new` from non-dashboard routes; on desktop it is mildly
   redundant with `g n`. The mild redundancy is the accepted cost of
   keeping the palette identical across viewports.

6. **Width pill and outline toggle do not appear in the mobile bar.**
   Both are pref-setting affordances whose visible effect requires
   wider viewports. They are reachable via `/settings` Reading section
   on mobile.

7. **Hide-on-scroll behavior:** scroll-down hides the bar; any
   scroll-up reveals it. Same UX pattern as iOS Safari's URL bar.
   Threshold and timing match the existing reader scroll-listener in
   `reader-shell.tsx` to avoid a second scroll listener.

8. **Brand-mark is desktop-only.** The non-interactive
   `md.niftymonkey.dev` wordmark in `src/components/brand-mark.tsx`
   remains `fixed bottom-4 left-4` on desktop and is hidden at `<md:`
   (the bar would otherwise occlude it). Component still mounts in
   `layout.tsx`; visibility is controlled by responsive classes.
   (Not to be confused with the removed `Watermark` popover from #36.)

9. **Cheat-sheet hidden at `<md:`.** No mount, no `?` listener on
   touch. The component stays as-is for desktop; the gating happens at
   the layout level.

## Constraints / boundaries

- The palette stays authed-only. Unauth shared-link viewers do not
  gain palette access on mobile.
- The bar is the *only* new piece of mobile chrome. No header, no
  drawer, no floating buttons.
- Desktop visuals are unchanged except for the `size-8 → size-9`
  toolbar button bump. No layout shifts, no new components rendered
  at `≥md:`.
- Implementation must respect `env(safe-area-inset-bottom)` so the bar
  sits cleanly above the iOS home-indicator and the auto-collapsing
  Safari URL bar.

## Relationship to other docs

- **`docs/cmd-palette-and-discoverability.md`** — load-bearing for the
  palette's principles. The "same shape on every page" doctrine and
  the editorial test for Actions slots both transfer directly to the
  mobile bar.
- **Post-#37 architecture map** (in user memory) — describes the
  current desktop architecture this work extends.
- **#25 (dashboard filter bar — tags + sort)** — when it ships, the
  filter bar is dashboard-content, not bar-content. The mobile bar
  does not gain a filter toggle; filtering remains an in-list
  affordance.

## Open questions

- Exact bar height and padding. ~48–56px is the working range; final
  number is an implementation detail, picked against real devices.
- Brand-mark placement on mobile (in-bar vs top-left). Not blocking.
- Whether the editor's Save button keeps its primary fill inside the
  bar, or whether the whole bar adopts a uniform visual treatment
  with the primary state reserved for one slot per route.
