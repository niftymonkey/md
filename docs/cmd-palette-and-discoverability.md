# Cmd palette + hotkey discoverability — design doc

This doc captures the rationale and target shape for refining the cmd palette and introducing a dedicated hotkey cheat-sheet. Implementation is tracked separately as a GitHub issue; this file is the load-bearing reference for whoever picks the work up.

## Context

PR #36 (merged 2026-05-02) made the cmd palette the operator's primary verb-tool. After living with it, three rough edges surfaced:

1. **The documents section feels unbounded.** Idle state shows up to 8 docs with no label explaining what they are (recent? all? filtered?). The bounds aren't obvious.
2. **The actions section mixes incompatible kinds of items.** Some are global verbs only reachable via the palette (Open settings, Sign out). Others are redundant with toolbar buttons or hotkeys (Back to dashboard, Copy link, View raw). Some are contextual "this document" verbs (Edit this, View this) that better belong on the surface they act on.
3. **There's no consistent place to learn what hotkeys exist.** Today the palette doubles as a hotkey advertisement board (`g d`, `g n` chips on palette rows), but that role conflicts with the palette's other jobs and doesn't scale as the hotkey count grows.

The Linear / Raycast reference lane (called out in PRODUCT.md) treats these as three different jobs: jumping (palette), browsing (filter bar), and hotkey learning (cheat-sheet). Today we conflate them.

## Principles

1. **Each tool has one job.** Palette = navigate to a thing or run a global verb. Filter bar = refine a list in place. Cheat-sheet = learn what hotkeys exist. No tool should drift into another's job.
2. **Each hotkey has exactly one discovery surface.** Either the toolbar tooltip (when a button already exists for click reasons) or the cheat-sheet. The palette is not a hotkey advertisement board.
3. **Editorial test for palette inclusion.** A candidate row earns a slot iff it is *the only path* to the action, *or* it is the find-by-name surface for an entity (today: documents). Discovery alone does not earn a slot — that's the cheat-sheet's job.
4. **Toolbar buttons earn their place by being click affordances.** Never add a button purely to advertise a hotkey. The tooltip-hotkey is a side benefit of a button that's already justified for clicking.

## Tool roles, sharply

| Tool | Job | Shape |
|---|---|---|
| **Toolbar** | Contextual click affordances on the surface they belong to. Tooltips advertise hotkeys for free. | Per-surface (reader, editor, settings, dashboard). |
| **Filter bar** *(dashboard only)* | Refine the doc list in place. Text + tags + sort. URL-stateful. | Owned by #25 (tags + dashboard filter chips). This issue does not duplicate it. |
| **Cmd palette** | Find a doc by name from anywhere; run a global verb that has no faster path. | Two sections: docs (Recent / Documents) + Actions. Same on every page. |
| **`?` cheat-sheet** | Single source of truth for every hotkey, grouped by surface. | Overlay triggered by `?` (Shift+/). Esc dismisses. |

## Cmd palette — current vs proposed

### Current (post-#36)

| Section | Idle | On query |
|---|---|---|
| Documents | up to 8 most-recent (no label) | up to 8 search hits (no label) |
| Actions | up to 8 contextual (Back to dashboard, New, Edit this, View this, Copy link, View raw, Open settings, Sign out) | filtered |

### Proposed

| Section | Idle | On query |
|---|---|---|
| `Recent` / `Documents` | 3 most-recent docs under the label `Recent` | up to 8 search hits under the label `Documents` |
| `Actions` | `Open settings`, `Sign out` | filtered |

Net: idle palette shows ~5 rows on every page, every entry is load-bearing, the docs section has a clear identity that changes with intent.

### What gets dropped from the palette and why

| Action | Why it leaves |
|---|---|
| Back to dashboard | `g d` hotkey + reader toolbar button + settings "← dashboard" link already cover it. Triple redundant. |
| New document | `g n` hotkey + dashboard primary button cover it. Double redundant. |
| Edit this document | Becomes a toolbar button on the reader (see below). |
| View this document | Becomes a toolbar button on the editor (see below). |
| Copy link | Reader toolbar button + `c` hotkey already cover it. |
| View raw markdown | Reader toolbar button + `r` hotkey already cover it. |

The hotkeys themselves (`g d`, `g n`, `c`, `r`) don't disappear — they migrate their discovery surface to the cheat-sheet (and tooltips, where the button already exists).

## Toolbar additions

- **Reader (`/v/[slug]`).** Add an "Edit document" button to the existing vertical toolbar cluster (alongside outline-toggle, R/W pill, copy-link, view-raw, dashboard). Visible only when the viewer is the authed operator. Tooltip: "Edit (e)".
- **Editor (`/edit/[slug]`).** Add a "View document" button to the editor's bottom button cluster (alongside Cancel and Save). Tooltip: "View".

After these additions, the cleanest contextual verbs for "this document" live on the surface where "this document" actually means something.

## `?` cheat-sheet

A modal overlay triggered by `?` (Shift+/) globally. Lists every hotkey grouped by surface:

- **Global** — `⌘K` palette, `g d` dashboard, `g n` /new, `?` this overlay
- **Reader** — `r` raw, `c` copy link, `o` toggle outline, `w` toggle width, `e` edit
- **Editor** — `⌘S` save, `Esc` cancel
- **Settings** — `Esc` back

Dismissed by Esc. Same trigger and dismiss model as the palette so the muscle memory is consistent. No discoverability surface for `?` itself beyond convention — this matches Linear, GitHub, Notion, Raycast.

## The discoverability pattern, codified

> A hotkey needs **exactly one** discovery surface. The toolbar is a discovery surface only as a side effect of being a click affordance — never add a button purely to advertise a hotkey. If a hotkey has no button (because the button isn't justified on its own merits), its discovery surface is the `?` cheat-sheet.

Concretely, after this change:

| Hotkey | Discovery surface |
|---|---|
| `⌘K` | Cheat-sheet + the dashboard's "press ⌘K to navigate" hint |
| `g d` | Cheat-sheet |
| `g n` | Cheat-sheet |
| `?` | Convention (no surface) |
| Reader `r` | Toolbar tooltip ("View raw (r)") + cheat-sheet |
| Reader `c` | Toolbar tooltip ("Copy link (c)") + cheat-sheet |
| Reader `o` | Toolbar tooltip ("Toggle outline (o)") + cheat-sheet |
| Reader `w` | Toolbar tooltip ("Toggle width (w)") + cheat-sheet |
| Reader `e` | Toolbar tooltip ("Edit (e)") + cheat-sheet |
| Editor `⌘S` | Save button kbd hint + cheat-sheet |
| Editor `Esc` | Cancel button kbd hint + cheat-sheet |

Every hotkey is reachable via the cheat-sheet; toolbar tooltips are the faster discovery path when the user already has hand-on-mouse.

## Relationship to other issues

- **#25 — Add tagging system (multi-label tags + edit chip-input + dashboard filters).** The dashboard filter bar is part of #25. The work in *this* issue does not duplicate that scope. When #25 ships, the filter bar gains tags as one of its dimensions; the principle that the filter bar lives on the dashboard (not in the palette) is settled here.
- **#36 — cmd palette + nav redesign (merged).** This issue is the follow-up that addresses what we learned by living with the post-#36 shape.

## Out of scope

- Dashboard filter bar (text + sort + tags). Owned by #25; expanding #25 to cover non-tag dimensions of the filter bar is a coordination call.
- Fuzzy match in the palette. Today's substring filter is fine for ~5 actions + ≤8 docs. Revisit only if the palette grows past ~12 rows.
- Dashboard's existing "press ⌘K to navigate" hint stays as-is.
- Per-doc indexing (#12), per-doc kind UI (deferred indefinitely per the conversation in PR #37).

## Open questions resolved during the design conversation

- **Should documents be page-scoped (e.g. hidden on dashboard)?** No. The palette is the only text-search surface in the entire app; hiding it anywhere strands docs that scrolled off the visible list. Docs section is identical on every surface.
- **Does every hotkey need a toolbar button?** No. Buttons exist for click reasons; tooltips advertise hotkeys as a side benefit. Hotkeys without buttons get their discovery from the cheat-sheet.
- **`?` cheat-sheet trigger — `?` only or also a discoverable element?** `?` only. Adding a `?` icon somewhere would be UX cliché and add chrome the system doesn't need. Convention covers it.
- **Should "Sign out" stay in the palette now that the settings page has it?** Yes. Sign-out is an infrequent terminal action that's useful from anywhere; navigating to settings to reach it is friction.
