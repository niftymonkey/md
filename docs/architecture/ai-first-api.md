# AI-first API for md.niftymonkey.dev

Architect-deep output, captured 2026-05-04 and revised 2026-05-22 once the work shipped. The original draft framed phasing as a recommendation; this revision records the API as it landed across PRs #47, #48, #54, #58, #59, #60, #61, #63, and #64. Items considered during the design and explicitly not built live under **Dismissed** below.

## Origin and intent

Two needs drove the original app:

1. Share markdown easily and have it render nicely outside the IDE.
2. Let an AI coding agent put markdown directly into the app and edit it as needed.

The shipped v1 ended up CLI- and script-friendly as a side benefit, and the user wants to keep that. The new work is **additive**: a parallel API surface designed for AI agents to read/edit/delete markdown as fluidly as they edit local files. The existing `/api/*` surface stays untouched.

## What "AI-first" actually means here

Three properties separate an AI-first surface from a CLI-friendly one. Bake these in or you'll end up with the existing API wearing a hat:

1. **Targeted mutation, not full-doc replacement.** Agents already think in `Edit` semantics — `old_string`/`new_string` with uniqueness or `replace_all`. The API contract should be the same shape so the agent's mental model and the wire format are isomorphic.
2. **Self-describing failure.** A 409 that says *"matched 4 times at lines 47, 112, 188, 256"* lets the agent fix and retry without re-reading the doc. CLI users tolerate vague errors; agents waste context on them.
3. **Recoverability is a contract, not a feature.** Agents make confident batch edits. The API must guarantee an undo path, or the first bad batch destroys work silently.

The existing `/api/*` surface is a fine CLI/scripting API. Don't change it. Mount the new surface at `/api/agent/*` — different namespace, different contract, same auth.

## Modules

Five survive the deletion test for AI-first work specifically. One candidate (a generic concurrency-check helper) didn't and is inlined until 3+ mutating endpoints exist.

### OperationApplier *(pure, in-process)*
- **Interface:** `apply(content, ops[]) → {content, perOpResults} | {failedAt, error, partialResults}`
- **What it hides:** ambiguity detection, line-shift bookkeeping, atomic rollback, the resolution rule (*line-addressed ops resolve against the batch-start snapshot; string-addressed ops resolve against running content*).
- **Leverage:** every mutating verb — single edit, batch, dry-run, section-replace — calls this one function.
- **Locality:** all edit semantics, including the subtle ones, land in one file with one test file.

### MatchResolver *(pure, in-process)*
- **Interface:** `findMatches(content, query, opts) → Match[]` with line/column/context.
- **What it hides:** ambiguity classification (zero/one/many) and the structured preview lines that ship in error responses.
- **Leverage:** OperationApplier *and* the dry-run path both consume it. Two real callers — earns its seam.

### EditOpSchema *(types)*
- Discriminated union: `replace`, `insertAfterLine`, `insertBeforeLine`, `deleteLineRange`, `replaceLineRange`, `setContent`, `replaceSection`.
- **Why a module:** the same type is the request body, the applier input, and the test fixture. Defining it once anchors the contract.

### SectionAddresser *(in-process, shipped in phase 2 via PR #60)*
- **Interface:** `resolveSection(content, headingPath) → {fromLine, toLine}`.
- **What it hides:** markdown AST work (heading levels, sibling boundaries, edge cases like duplicate headings).
- **Leverage:** unlocks `replaceSection`, the most natural edit unit for prose. Deliberately held out of phase 1 so phase-1 string and line ops could cover 80% of cases first; SectionAddresser then earned its depth against real usage.

### AgentEndpoints *(HTTP layer, namespaced at `/api/agent/*`)*
- **Interface:** the verbs below. Every handler is a thin wrapper: parse → call applier → call `DocMutationPath.writeDocContent` (from #45) → return typed result or structured 409.
- **What it hides:** auth re-use (the existing `requireAuth` works unchanged), JSON ↔ EditOp marshaling. Transaction shape and revision-recording are owned by `DocMutationPath`, not duplicated here.
- **Locality:** new wire shapes never touch the existing handlers.

No category-3 or category-4 dependencies surfaced. **No external ports.** Tests cross the HTTP boundary against real Postgres and the real applier.

## Dependencies from #45 (Document revision history)

Two modules ship in #45 and are reused here. Full design lives in `docs/architecture/revision-history.md`.

- **`DocMutationPath`**: the chokepoint every content write flows through. Signature as shipped: `writeDocContent({docId, newContent, summary, source, ownerId, expectedRevisionId?, newTitle?, newSearchText?, newKind?, newTags?})` returns `{ok: true, doc, revisionId}` on success or `{ok: false, kind: 'revision_mismatch', currentRevisionId}` when an `expectedRevisionId` was passed and did not match under `FOR UPDATE`. The agent edit handler calls it with `source: 'agent'`. Revision recording, diff stats, and the transaction boundary are all inside.
- **`RevisionLog`** — owns `doc_revisions`. The agent surface doesn't call it directly; it goes through `DocMutationPath`.

The `source` enum (defined in #45): `'manual' | 'cli' | 'agent' | 'restore'`. The `'agent'` value is reserved for this surface — added to the enum in #45 so #46 doesn't need a schema migration.

## Phased path (as shipped)

> **Prerequisite:** issue #45 (Document revision history with restore). Shipped the `doc_revisions` table, `RevisionLog` module, `DocMutationPath` chokepoint, `DiffStats` utility, history API verbs, and history UI. The AI-first surface inherits all of it through a single `DocMutationPath.writeDocContent(..., source: 'agent')` call from each edit handler.

Every phase below is merged. PR references identify the change that landed each item.

### Phase 1: Minimum AI-first surface (PR #48, closes #46)
- `EditOpSchema` + `MatchResolver` + `OperationApplier` as in-process modules, fully unit-tested with zero HTTP.
- `POST /api/agent/docs/<slug>/edits`: body `{ops: [...]}`, per-batch atomic, structured 409 with line previews. The handler runs `OperationApplier.apply(...)` to compute new content, then calls `DocMutationPath.writeDocContent({source: 'agent', summary, ...})`. Every agent edit flows through the same chokepoint as manual edits and is recorded automatically.
- `GET /api/agent/docs/<slug>`: JSON `{id, slug, title, kind, tags, content, lineCount, createdAt, updatedAt, revisionId}`.
- `POST /api/agent/docs`: create, a JSON-shaped mirror of `/api/upload` in the agent namespace for surface symmetry.

**Bonus DX added during Phase 1 (PR #54):**
- `setContent` op for full-document saves; exclusive in its batch (mixing with other ops is rejected at parse time, since their resolution rules become ill-defined once the body is wiped).
- `to: -1` sentinel on line ranges, meaning "to end of document". Resolution surfaces the resolved value before overlap detection so two `-1` ops compare correctly.
- `lineCount` on the GET response, computed by the same `visibleLineCount` rule the applier uses internally, so the agent and the server cannot disagree.

### Phase 2: Quality of life
- `dryRun: true` on `/edits` (PR #58, closes #49). Runs `OperationApplier.apply` and `MatchResolver` as normal, skips the persist step, and returns the would-be result or the structured 409.
- Optimistic concurrency via `current_revision_id` (PR #59, closes #51). Agents echo the GET response's `revisionId` in an `If-Match: <revisionId>` header; mismatch returns **412** with `currentRevisionId`. The check is re-run under `FOR UPDATE` inside `writeDocContent`, so a stale write that slipped past the cheap pre-check still 412s.
- `replaceSection` op (PR #60, closes #50). New `SectionAddresser` module over the markdown AST resolves a `headingPath` to a line range; the existing applier consumes the result.
- `md-niftymonkey` skill moved in-repo at `.claude/skills/md-niftymonkey/SKILL.md` with `.github/workflows/sync-skill.yml` mirroring it to the on-md hosted copy (PR #61, closes #56). One skill teaches the entire shipped surface; the hosted copy is a published artifact, not a fork.

### Phase 3: Multi-document leverage
- `POST /api/agent/edits`: cross-document batch (PR #63, closes #53). Per-document atomic via `OperationApplier` + `DocMutationPath`; batch best-effort with a per-doc `{slug, status, ...}` results array. Always returns 200; per-doc outcomes live in `results`. `If-Match` is single-doc only (a single header cannot address N docs); duplicate slugs are rejected at parse time.
- `GET /api/agent/search?q=...`: owner-scoped full-text search returning per-match `{line, column, previewLines}` contexts (PR #64, closes #52). FTS narrows the candidate set, then `findMatches` extracts literal substring contexts; candidates that fail the literal check (case mismatch, stem-only) drop out, so every returned doc carries actionable matches. Per-doc match cap of 5 with the true total in `matchCount`.

## What this gets us

- **Existing CLI/scripting consumers untouched.** `/api/*` keeps last-write-wins semantics; nothing breaks.
- **Agents get a surface shaped like their tools.** `Edit`-style ops, structured ambiguity errors, revision-aware reads with optimistic concurrency. The skill is the handshake: when an agent sees `md-niftymonkey`'s SKILL.md in context, it inherits the calling pattern.
- **Recoverability lands first**, so the moment the new mutation verb exists, every write is reversible — including writes through the old API.
- **One engine, every surface.** OperationApplier serves both agent edit endpoints (single-doc `/api/agent/docs/<slug>/edits` and cross-doc `/api/agent/edits`) and could back a future `/api/edits` v2 if the CLI surface ever wants to converge.

## Dismissed

Considered during the design and explicitly not built. Recorded here so future sessions do not re-litigate.

- **Agent-namespace revisions and restore mirrors.** The original Phase 2 listed `GET /api/agent/docs/<slug>/revisions` and `POST /api/agent/docs/<slug>/restore`. Dismissed: the existing `/api/docs/<slug>/revisions` and `/api/docs/<slug>/restore` already accept bearer auth (shipped in PR #47), so agents use those today. Duplicating the routes into `/api/agent/*` adds maintenance for no behavior gain.
- **Two-skill split (`md-upload` + `md-edit`).** The original Phase 1 floated splitting the skill. As shipped, one `md-niftymonkey` skill teaches the whole API (upload, fetch, search, edit, list, delete) without trigger conflicts. The original Phase 3 "skill consolidation" item is dismissed for the same reason: there is nothing to consolidate.
- **`version` integer column for optimistic concurrency.** The original Phase 1 GET listed `{content, version, updatedAt}` and Phase 2 referenced `If-Match: <version>`. As shipped (PR #59), concurrency uses `current_revision_id` instead. The GET response carries `revisionId`; the agent sends `If-Match: <revisionId>`; mismatch returns 412 with `currentRevisionId`. Reusing the existing revision external-id avoided introducing a parallel monotonic counter and matched the column already needed for fast current-revision lookups.

## Status

As of 2026-05-22 the AI-first API surface is complete. Phase 1, Phase 2, and Phase 3 are all merged; the `md-niftymonkey` skill teaches every shipped verb and is CI-synced from the repo to its hosted copy. The phased plan above is now a record of what shipped, not a roadmap. Future work on this surface should be filed as new tickets.
