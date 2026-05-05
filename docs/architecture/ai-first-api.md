# AI-first API for md.niftymonkey.dev

Architect-deep output, captured 2026-05-04. Ad-hoc design conversation, saved at the user's request so the next session can resume from this exact state. Not yet a PRD or plan — module shapes and phasing only.

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
- **Leverage:** every mutating verb — single edit, batch, dry-run, future section-replace — calls this one function.
- **Locality:** all edit semantics, including the subtle ones, land in one file with one test file.

### MatchResolver *(pure, in-process)*
- **Interface:** `findMatches(content, query, opts) → Match[]` with line/column/context.
- **What it hides:** ambiguity classification (zero/one/many) and the structured preview lines that ship in error responses.
- **Leverage:** OperationApplier *and* the dry-run path both consume it. Two real callers — earns its seam.

### EditOpSchema *(types)*
- Discriminated union: `replace`, `insertAfterLine`, `insertBeforeLine`, `deleteLineRange`, `replaceLineRange`. Phase-2 adds `replaceSection`.
- **Why a module:** the same type is the request body, the applier input, and the test fixture. Defining it once anchors the contract.

### SectionAddresser *(in-process, deferred to phase 2)*
- **Interface:** `resolveSection(content, headingPath) → {fromLine, toLine}`.
- **What it hides:** markdown AST work (heading levels, sibling boundaries, edge cases like duplicate headings).
- **Leverage:** unlocks `replace_section`, the most natural edit unit for prose. Don't ship it in phase 1 — phase-1 string+line ops cover 80% and SectionAddresser earns more depth once real usage points at the gaps.

### AgentEndpoints *(HTTP layer, namespaced at `/api/agent/*`)*
- **Interface:** the verbs below. Every handler is a thin wrapper: parse → call applier → call `DocMutationPath.writeDocContent` (from #45) → return typed result or structured 409.
- **What it hides:** auth re-use (the existing `requireAuth` works unchanged), JSON ↔ EditOp marshaling. Transaction shape and revision-recording are owned by `DocMutationPath`, not duplicated here.
- **Locality:** new wire shapes never touch the existing handlers.

No category-3 or category-4 dependencies surfaced. **No external ports.** Tests cross the HTTP boundary against real Postgres and the real applier.

## Dependencies from #45 (Document revision history)

Two modules ship in #45 and are reused here. Full design lives in `docs/architecture/revision-history.md`.

- **`DocMutationPath`** — the chokepoint every content write flows through. Signature: `writeDocContent({docId, newContent, summary, source, ownerId}) → {version}`. The agent edit handler calls it with `source: 'agent'`. Revision recording, diff stats, and transaction boundary are all inside.
- **`RevisionLog`** — owns `doc_revisions`. The agent surface doesn't call it directly; it goes through `DocMutationPath`.

The `source` enum (defined in #45): `'manual' | 'cli' | 'agent' | 'restore'`. The `'agent'` value is reserved for this surface — added to the enum in #45 so #46 doesn't need a schema migration.

## Phased path

> **Prerequisite:** issue #45 (Document revision history with restore). Ships the `doc_revisions` table, `RevisionLog` module, `DocMutationPath` chokepoint, `DiffStats` utility, history API verbs, and history UI before this work begins. The AI-first surface inherits all of it through a single `DocMutationPath.writeDocContent(..., source: 'agent')` call from the new edit handler.

### Phase 1 — Minimum AI-first surface
- `EditOpSchema` + `MatchResolver` + `OperationApplier` as in-process modules. Fully unit-tested with zero HTTP.
- `POST /api/agent/docs/<slug>/edits` — body `{ops: [...]}`, atomic, structured errors with line previews. Handler runs `OperationApplier.apply(...)` to compute new content, then calls `DocMutationPath.writeDocContent({source: 'agent', summary, ...})` (module shipped in #45). Every agent edit flows through the same chokepoint as manual edits and is recorded automatically.
- `GET /api/agent/docs/<slug>` — JSON `{content, version, updatedAt}`.
- `POST /api/agent/docs` — create (mirror of `/api/upload`, JSON-shaped, lives in the agent namespace for surface symmetry).
- Update `~/.claude/skills/md-upload/SKILL.md` to teach the edit verb. (Or split into a sibling `md-edit` skill — leans toward separate so each skill stays single-purpose and triggers cleanly.)

### Phase 2 — Quality of life
- `If-Match: <version>` enforcement on `/edits`.
- `dryRun: true` on `/edits` — uses MatchResolver alone, no write.
- `GET /api/agent/docs/<slug>/revisions` (list), `POST /api/agent/docs/<slug>/restore`.
- `SectionAddresser` ships, unlocking `replaceSection` ops.

### Phase 3 — Multi-doc leverage
- `POST /api/agent/edits` — cross-doc batch, per-doc atomic.
- `GET /api/agent/search?q=...` — owner-scoped grep across all docs, returning slug + match contexts.
- Skill consolidation if md-upload + md-edit both feel cramped.

## What this gets us

- **Existing CLI/scripting consumers untouched.** `/api/*` keeps last-write-wins semantics; nothing breaks.
- **Agents get a surface shaped like their tools.** `Edit`-style ops, structured ambiguity errors, version-aware reads. The skill is the handshake — when an agent sees `md-edit`'s SKILL.md in context, it inherits the calling pattern.
- **Recoverability lands first**, so the moment the new mutation verb exists, every write is reversible — including writes through the old API.
- **One engine, two surfaces.** OperationApplier serves `/api/agent/edits` today and could back a future `/api/edits` v2 if the CLI surface ever wants to converge.

## Open thread

User signaled they want to dig into "a different facet of this" next. Resume from the end of this doc — no decisions are locked yet, no PRD has been drafted, no issues have been filed. Phasing above is a recommendation, not a commitment.
