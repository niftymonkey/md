# Document revision history

Architect-deep output for issue #45. Captured 2026-05-05. Implementation reference for the revision-history feature: schema, modules, endpoints, UI shape, and the explicit out-of-scope items.

## Goal

Every successful content mutation to a document is recoverable. The same data feeds an authed history UI in the dashboard *and* (later, via #46) agent-driven edits — both flow through the same chokepoint and land in the same history.

## Modules

Four survive the deletion test. Several candidates collapsed into helpers or vanished as one-caller inlines.

### DocMutationPath *(the chokepoint)*

- **Interface:** `writeDocContent({docId, newContent, summary, source, ownerId}) → {version}`. Reads current content, writes new content, calls `RevisionLog.record(...)`, all in a single transaction.
- **What it hides:** transaction boundary, the "snapshot before write" step, source-tagging of every mutation, the diff-stats call.
- **Leverage:** PATCH calls it. `/restore` calls it. `/api/agent/edits` (#46) calls it. The "every mutation snapshots" property is structural, not vigilant. No mutating endpoint can forget to record a revision because there is no other code path that touches `docs.content`.
- **Locality:** if snapshotting policy ever changes (async backups, hooks, conditional skips), one file moves.
- **Why it's a module:** without it, every mutating handler inlines the same five steps (read prev → diff → update docs row → record revision → return version). One caller today; three known future callers. The deletion test concentrates here.

### RevisionLog *(local-substitutable: Postgres)*

- **Interface:** `record({docId, prevContent, nextContent, summary, source, ownerId}, runner?) → {externalId, createdAt}`, `list(docId, {limit, cursor}) → {revisions, nextCursor}`, `get(docId, externalId) → Revision | null`, `countByDoc(docIds[]) → Record<docId, number>`. `prevContent` is what's stored in the row (model B); `nextContent` is used only to compute byte deltas via `DiffStats`. Optional `runner` lets the caller pass a transactional client.
- **What it hides:** the `doc_revisions` schema, retention cap (last 50 per doc, prune on insert), ordering, external-ID generation, the `DiffStats` call that computes byte deltas at write time.
- **Why it doesn't own restore:** Shape A (RevisionLog.restore) would force this module to write into the `docs` table, crossing the boundary it's supposed to own. Shape B (caller-orchestrated) keeps RevisionLog scoped to one table; restore is just `RevisionLog.get(...)` followed by `DocMutationPath.writeDocContent(..., source: 'restore')`.
- **Leverage:** the only reader/writer of `doc_revisions`. Tests stay scoped to one table.

### DiffStats *(pure, in-process)*

- **Interface:** `computeDiff(prev, next) → {bytesAdded, bytesRemoved}`.
- **Why a module:** real diff, not length subtraction. Used inside `RevisionLog.record` so the UI gets `+412 / −88` badges without rehydrating both contents. Earns extraction because the impl is non-trivial enough that test surface = one pure function.

### HistoryUI *(authed dashboard surface)*

- **What it hides:** route layout, mobile layout, restore-confirm UX.
- **Surface:**
  - `/edit/<slug>/revisions` — list panel
  - `/edit/<slug>/revisions/<id>` — view a single revision read-only
- **Reuse:** the markdown rendering pipeline used by `/v/<slug>` (`parseFrontmatter` + `FrontmatterDisclosure` + `MarkdownRenderer`) is reused here, but the route is new and authed. The public `/v/<slug>` does not gain a `?rev=` parameter — history would leak to anyone with the slug.
- **Restore:** action triggers a confirm UI, then `POST /api/docs/<slug>/restore`.

## Schema (`doc_revisions`)

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | Internal ordering. Never exposed in API. |
| `external_id` | text, unique | Slug-style, e.g. `rv_aB12...`. What the API and UI use. |
| `doc_id` | FK → `docs.id` | Cascade on delete. |
| `content` | text | Full snapshot. No deltas. |
| `summary` | text, nullable | Headline for UI rows. Agent batch-edits self-summarize ("Replaced 23 em-dashes; rewrote intro"). Manual edits default to "Manual edit." Restores get "Restored from `<external_id>`." |
| `source` | enum | `'manual' \| 'cli' \| 'agent' \| 'restore'`. See "Source enum" below. |
| `created_by` | text (owner_id) | Same shape as `docs.owner_id`. |
| `created_at` | timestamptz | Ordering + display. |
| `bytes_added` | int | Computed at write time via `DiffStats`. |
| `bytes_removed` | int | Computed at write time via `DiffStats`. |

**Retention:** keep last 50 per doc; prune on insert. User-configurable later if it ever matters.

**Snapshots, not deltas.** O(1) restore. At a 1MB cap × 50 revisions × small doc count, storage is fine on Neon. Don't trade simplicity for storage we don't need to save.

## Source enum

`'manual' | 'cli' | 'agent' | 'restore'`. Values reflect *endpoint context*, not auth method. Auth method couldn't distinguish what the UI needs to show — a curl from a human and an agent-driven call both present as bearer.

| Value | Meaning | Set by |
|---|---|---|
| `'manual'` | Dashboard UI write (session-authed) | PATCH handler |
| `'cli'` | `/api/*` write with bearer auth | PATCH handler |
| `'agent'` | `/api/agent/*` write (#46) | Agent edit handler — **reserved in #45**, used in #46 |
| `'restore'` | Any restore action, regardless of who triggered it | `/restore` handler |

The `'agent'` value is added to the enum in #45 even though no caller uses it yet, so #46 doesn't require an enum extension migration.

## API verbs (live on `/api/*`, not AI-specific)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/docs/<slug>/revisions` | bearer or session | Paginated, metadata only (no content). `?limit=`, `?cursor=`. |
| `GET` | `/api/docs/<slug>/revisions/<id>` | bearer or session | Single revision content. |
| `POST` | `/api/docs/<slug>/restore` | bearer or session | Body: `{revisionId}`. Reads via `RevisionLog.get`, writes via `DocMutationPath` with `source: 'restore'`. The restore is itself recorded as a new revision. |

Existing `PATCH /api/docs/<slug>` is refactored to call `DocMutationPath.writeDocContent` instead of mutating content inline.

## Restore is itself a revision

`POST /api/docs/<slug>/restore` does three things:
1. `RevisionLog.get(docId, revisionId)` — fetch old content.
2. `DocMutationPath.writeDocContent({newContent: oldContent, summary: "Restored from rv_xY8z", source: 'restore', ownerId})`.
3. Return the new version.

Step 2 records a *new* revision automatically — the linear audit trail has no special-case "this got restored" annotation. The history UI shows the restore as a row with `source: 'restore'`.

## Out of scope for #45

| Item | Why deferred |
|---|---|
| Title/kind changes don't snapshot content | "History" intuitively means content history. Title-only edits shouldn't pollute revision rows. If renames become a recovery need, add a separate entry type later. |
| DELETE is not undoable | Soft-delete is its own feature. Deleting a doc cascades its revisions and stays gone. |
| Optimistic concurrency (`If-Match`) | Defers to #46 phase 2. |
| Diff endpoint (`/diff?from=...&to=...`) | UI can compute diffs client-side from `bytes_added/removed` + content. Server-side diff is a phase-2 win once real usage points at the need. |

## What this gets us

- **One mutation chokepoint.** Every content write — past, present, future — flows through `DocMutationPath`. There is no second code path.
- **History as a structural property, not a feature.** Recording is automatic; no caller can forget.
- **Clean handoff to #46.** The agent edit handler is one extra line: `await DocMutationPath.writeDocContent({..., source: 'agent'})`. No duplicated wiring.
- **UI privacy.** History never leaks to public reader. Authed-route shape matches the rest of the dashboard.
- **Linear audit trail.** Restores show up as their own row, no special-case annotation.

## Build order inside the ticket

1. Schema migration: `doc_revisions` table + `source` enum (with all four values).
2. `DiffStats` (pure utility, fully unit-testable).
3. `RevisionLog` (record / list / get / internal prune).
4. `DocMutationPath` (calls `RevisionLog.record`).
5. Refactor `PATCH /api/docs/<slug>` to use `DocMutationPath`.
6. New API verbs: `/revisions`, `/revisions/<id>`, `/restore`.
7. History UI: list route, view route, restore confirm flow.
8. Mobile parity pass.

Steps 1–4 are pure backend, fully unit-testable, no UI consumer. Step 5 is the smallest possible refactor (existing tests should stay green). Step 6 is thin glue. Steps 7–8 are the bulk of the visible work.
