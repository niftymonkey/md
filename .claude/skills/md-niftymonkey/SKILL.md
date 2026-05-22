---
name: md-niftymonkey
description: Work with markdown on md.niftymonkey.dev: upload, fetch, search, edit, list, and delete. Use when the user asks to upload, share, or publish markdown to md.niftymonkey.dev, fetch a doc back, find which of their docs mention a term, make targeted edits to an existing doc, replace a section by heading, preview an edit before committing, save a fresh full-doc version, coordinate edits with optimistic concurrency, or apply one set of edits across many docs at once. Triggers on phrases like "upload this to md.niftymonkey", "share this as a markdown link", "put this on md", "fix the typo on my md doc", "update the md doc at <slug>", "rewrite the API section on <slug>", "preview this edit on md", "rename a term across all my md docs", "which of my md docs mention X", or pointing at a `.md` file with intent to share or modify on this service. Handles atomic find/replace, line-addressed edits, heading-addressed section replacement, dry-run validation, If-Match optimistic concurrency, cross-document batch edits, owner-scoped full-text search with per-match contexts, and structured retry errors.
---

# md-niftymonkey

Upload, fetch, edit, list, and delete markdown documents on **md.niftymonkey.dev**. Public viewer URLs render with full GitHub-flavored markdown, syntax highlighting, and mermaid diagrams.

> **API era:** Phase 2 of the AI-First API (verbs: `replace`, `insertAfterLine`, `insertBeforeLine`, `deleteLineRange`, `replaceLineRange`, `setContent`, `replaceSection`; flags: `dryRun`; headers: `If-Match`). If a request returns a shape this skill doesn't recognize, the API may have moved on — re-pull the skill from the repo or hosted slug.

## Authentication

Every API call needs `Authorization: Bearer <key>`. The key is a personal API token — create one at https://md.niftymonkey.dev/settings while signed in. Tokens start with `mdk_` and are shown once at creation time; the server stores only a hash, so a lost token has to be revoked and replaced rather than recovered.

Set the token in the shell environment as `MD_API_KEY` before invoking the API. If a request returns 401, the token has been revoked or was never valid — generate a new one at /settings.

## Upload

```bash
curl -sS -X POST https://md.niftymonkey.dev/api/upload \
  -H "Content-Type: text/markdown" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Accept: text/plain" \
  --data-binary @<path-to-md-file>
```

`Accept: text/plain` returns just the URL on stdout — pipe-friendly. Drop it for full JSON `{slug, viewUrl, id, title, createdAt}`.

For inline content the agent generated in the conversation, write it to a temp file first to sidestep quoting and special-character pitfalls in shell, upload that file, then delete it.

### Title

Title resolves: explicit override → first `# H1` in content → `"Untitled"`. Default to letting the API auto-extract from the H1 — that's the right move almost every time. Make sure the markdown opens with a meaningful `# Title` line.

When overriding, **always use the JSON path**, never the `X-Title` header. HTTP headers don't reliably carry non-ASCII, so em-dashes, smart quotes, accents, and emoji come back garbled when sent that way. JSON request bodies are parsed as UTF-8 end-to-end.

```bash
JSON=$(jq -nc --rawfile c <path-to-md-file> --arg t "Title with — em-dashes" '{title: $t, content: $c}')
curl -sS -X POST https://md.niftymonkey.dev/api/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Accept: text/plain" \
  -d "$JSON"
```

### Kind (optional)

`kind` is a free-form tag for grouping docs (e.g. `note`, `essay`, `recipe`). The server normalizes: trim, lowercase, max 64 chars. Send via the JSON `kind` field, or via the `X-Kind` header for raw uploads (ASCII-only — unlike titles, identifiers don't need UTF-8).

```bash
# JSON
JSON=$(jq -nc --rawfile c <path-to-md-file> --arg k "essay" '{kind: $k, content: $c}')

# Raw header form
curl -sS -X POST https://md.niftymonkey.dev/api/upload \
  -H "Content-Type: text/markdown" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "X-Kind: essay" \
  --data-binary @<path-to-md-file>
```

### Limits

- 1 MB max content size — 413 if exceeded.
- Empty / whitespace-only content — 400.
- `kind` over 64 characters — 400.

## Fetch

Read a doc back. The public raw endpoint requires no auth.

```bash
# Markdown body
curl -sS https://md.niftymonkey.dev/api/raw/<slug>

# JSON: { slug, title, kind, content, createdAt, updatedAt }
curl -sS -H "Accept: application/json" https://md.niftymonkey.dev/api/raw/<slug>
```

For agent-context fetches that need line-count metadata for planning line-addressed edits, use the agent endpoint (auth required):

```bash
curl -sS https://md.niftymonkey.dev/api/agent/docs/<slug> \
  -H "Authorization: Bearer $MD_API_KEY"
```

Response: `{id, slug, title, kind, content, lineCount, revisionId, createdAt, updatedAt}`.

- `lineCount` is the canonical visible-line count the server uses to validate line-addressed ops — use it directly rather than computing your own. A `split("\n").length` on content with a trailing newline will be off by one, every time.
- `revisionId` is the optimistic-concurrency token. Echo it back in the `If-Match` header on the next edit to detect intervening writes (see "Optimistic concurrency" below). `null` for fresh docs that have never been edited.

## Edit — full replace (PATCH)

Update an existing doc in place. Slug stays stable. Send any subset of `content`, `title`, `kind`. At least one field is required.

```bash
# Replace content (title preserved unless also sent)
JSON=$(jq -nc --rawfile c <path-to-md-file> '{content: $c}')
curl -sS -X PATCH https://md.niftymonkey.dev/api/docs/<slug> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -d "$JSON"

# Set or clear title
curl -sS -X PATCH https://md.niftymonkey.dev/api/docs/<slug> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -d '{"title": "New title"}'   # or '{"title": null}' to re-derive from H1

# Set or clear kind
curl -sS -X PATCH https://md.niftymonkey.dev/api/docs/<slug> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MD_API_KEY" \
  -d '{"kind": "essay"}'   # or '{"kind": null}' to clear
```

Returns 200 with `{id, slug, title, kind, content, createdAt, updatedAt}`. 404 unknown slug, 400 empty body / invalid field, 413 over 1 MB.

**Title rederivation rule:** PATCH only changes what you send. To re-derive title from a new H1, send `{"title": null}` (optionally alongside `content`).

PATCH writes record a `cli`-source revision in the doc's history. For agent-attributed history, use the targeted edits API below.

## Edit — targeted (agent ops API)

Use this for changing *part* of a doc — fix a typo, swap a paragraph, append a section, replace a code fence, rewrite the "API" section by name — without rewriting the rest. PATCH replaces the entire body; this API is shaped like an `Edit` tool: find/replace, line-addressed inserts/deletes, and heading-addressed section replacement, atomic across a batch, with structured errors that name exactly why a query failed and where. Successful edits create an `agent`-source revision, viewable at `https://md.niftymonkey.dev/edit/<slug>/revisions`.

### Fetch first

Pull current state with the agent endpoint above so line numbers and find strings anchor against what's really there. Use the returned `lineCount` when planning line-addressed ops, and `revisionId` when you want optimistic concurrency.

### Apply ops

```bash
curl -sS -X POST https://md.niftymonkey.dev/api/agent/docs/<slug>/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ops": [
      {"type": "replace", "find": "old phrase", "replace": "new phrase"}
    ],
    "summary": "fix typo"
  }'
```

Returns `{doc, revisionId}` on success. Body shape: `{ops: [...], summary?: string|null, dryRun?: boolean}`. `summary` is shown in the revision history UI; keep it short and specific. `dryRun: true` validates without writing (see "Preview only" below).

### Op types

| Type | Required fields | Notes |
|---|---|---|
| `replace` | `find`, `replace` | String match. Default requires uniqueness — pass `replaceAll: true` to hit every occurrence. `find` must be non-empty. |
| `insertAfterLine` | `line`, `content` | Inserts `content` plus newline after the 1-indexed line. `line: 0` means "before line 1" (top of file). |
| `insertBeforeLine` | `line`, `content` | Inserts before the 1-indexed line. Minimum `line: 1`. |
| `deleteLineRange` | `from`, `to` | Inclusive 1-indexed range. `to: -1` means "through end of doc". |
| `replaceLineRange` | `from`, `to`, `content` | Replaces the inclusive range with `content` (newline auto-appended). Empty `content` collapses to delete. `to: -1` means "through end of doc". |
| `setContent` | `content` | Replaces the entire body. Must be the only op in its batch. The "save as" verb — use this for full-doc rewrites that should record an `agent` revision. Title re-derives from the new H1, like upload. |
| `replaceSection` | `headingPath`, `content` | Replaces a section addressed by heading nesting. `headingPath` is top-down trace of heading texts (e.g. `["API", "Errors"]` matches the H_n "Errors" nested directly under H_(n-1) "API"). The replaced span runs from the matched heading line through the line before the next sibling-or-higher heading. `content` typically includes a heading line. |

### Saving the whole body

When the agent has a freshly-generated full document and wants to push it (recording an `agent` revision rather than the `cli` revision PATCH would record), use `setContent`:

```bash
JSON=$(jq -nc --rawfile c <path-to-md-file> '{ops:[{type:"setContent", content:$c}], summary:"sync from local file"}')
curl -sS -X POST https://md.niftymonkey.dev/api/agent/docs/<slug>/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON"
```

One call. No fetch round-trip. Atomic. Recorded as an agent revision. Don't reach for `replaceLineRange from:1 to:-1` for this — `setContent` is what the verb is named for and reads cleaner in revision history.

### Replacing a section by heading

When the user says "rewrite the Setup section" or "update the API/Errors part", reach for `replaceSection` instead of fetching, counting lines, and computing a `replaceLineRange`. The server walks the markdown tree, finds the heading by name, and resolves the section bounds for you.

```bash
JSON=$(cat <<'EOF'
{
  "ops": [
    {
      "type": "replaceSection",
      "headingPath": ["API", "Errors"],
      "content": "## Errors\n\nNew errors body. Note that I included the heading line — the replacement covers the heading too."
    }
  ],
  "summary": "rewrite errors section"
}
EOF
)
curl -sS -X POST https://md.niftymonkey.dev/api/agent/docs/<slug>/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$JSON"
```

- `headingPath` matches against rendered heading text — inline formatting like `**bold**` is stripped, surrounding whitespace is trimmed, matching is case-sensitive.
- The replaced span includes the heading line itself. Include a heading line in `content` unless you want to drop the heading entirely.
- A parent path like `["API"]` covers the parent's whole subtree (children at deeper levels are inside the section).
- A child path like `["API", "Errors"]` covers only that child's section, ending at the next sibling (or shallower heading, or end of doc).
- Headings inside fenced code blocks don't count.

If the heading text is duplicated (two `## Errors` under the same parent, or two top-level `# API`), the server returns `ambiguous_heading` with `matchCount`. Add a sibling-or-parent component to disambiguate, or fall back to a line-addressed op.

### Preview only (dryRun)

Pass `dryRun: true` to validate ops and return the would-be content without writing. The doc isn't touched; no revision is recorded. Use this when you want to surface the planned change for human approval before committing, or when building up a complex batch and you want certainty before applying.

```bash
curl -sS -X POST https://md.niftymonkey.dev/api/agent/docs/<slug>/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ops": [
      {"type": "replace", "find": "old phrase", "replace": "new phrase"}
    ],
    "dryRun": true
  }'
```

Successful response includes the same `{doc: {...content: <preview>}}` shape as a real call, plus `revisionId: null` and a `dryRun: true` marker so you can verify the flag was honored. Resolution failures (ambiguous match, line out of range, etc.) return the same structured 409 a real call would. The 1 MB content cap still fires (413) — that's a real preview signal, not a write.

### Optimistic concurrency (If-Match)

When you fetched the doc and want to be certain no other writer changed it before your edit lands, send the `If-Match: <revisionId>` header. The revisionId comes from the GET response (or from a prior successful edit's response). The server compares it under transactional lock, so the check is race-free.

```bash
# 1. Fetch and capture revisionId
META=$(curl -sS https://md.niftymonkey.dev/api/agent/docs/<slug> \
  -H "Authorization: Bearer $MD_API_KEY")
REV=$(printf '%s' "$META" | jq -r '.revisionId')

# 2. Edit with If-Match
curl -sS -X POST https://md.niftymonkey.dev/api/agent/docs/<slug>/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "If-Match: $REV" \
  -d '{"ops":[{"type":"replace","find":"x","replace":"y"}]}'
```

If the doc has changed since you fetched (or has a non-null `revisionId` and you sent the wrong one), the server returns **412** with `{error: "revision_mismatch", currentRevisionId: "<latest>"}`. Re-fetch (the new GET will include the up-to-date `revisionId`), reconcile your plan against the new content, and retry.

A fresh doc that has never been edited has `revisionId: null` from GET. Concurrency protection requires a non-null token, so for the first edit on a brand-new doc, omit `If-Match`. Subsequent edits can use it normally.

`If-Match` works in `dryRun` too — a stale token short-circuits to 412 before any preview work, so you can use dryRun + If-Match as a "would this still apply cleanly?" probe without committing.

### Resolution rules in batches

- **Line-addressed and heading-addressed ops resolve against the doc as fetched** (the snapshot). Two `deleteLineRange` ops in the same batch reference the original line numbers; a `replaceSection` in the same batch resolves headings against the same snapshot.
- **String-addressed ops (`replace`) resolve against running content** — they see prior ops in the same batch.
- Line-addressed and heading-addressed ops in the batch must not target overlapping ranges; that returns `overlapping_line_ops`.
- `setContent` is exclusive — mixing it with any other op returns 400.

### Structured errors (409)

Any resolution failure aborts the entire batch — the doc is not modified, no revision is recorded.

```json
{
  "error": "ambiguous_match",
  "failedAt": 0,
  "query": "foo",
  "matchCount": 4,
  "matches": [
    {
      "line": 47,
      "column": 1,
      "previewLines": [
        {"line": 46, "text": "intro"},
        {"line": 47, "text": "foo bar"},
        {"line": 48, "text": "trailing"}
      ]
    },
    {
      "line": 112,
      "column": 8,
      "previewLines": [
        {"line": 111, "text": "context"},
        {"line": 112, "text": "before foo end"},
        {"line": 113, "text": "more"}
      ]
    }
  ]
}
```

Each entry in `matches` is one location with its own context window (capped at 5 — `matchCount` always reports the true total). Use the previews to choose a longer `find` string that uniquely targets the match you want.

| `error` | Cause | What to do |
|---|---|---|
| `no_match` | `find` string is absent. | Re-fetch — content may have changed, or the query is wrong. |
| `ambiguous_match` | `find` matched > 1 times without `replaceAll`. | Add surrounding context to `find` until unique, or set `replaceAll: true` if all occurrences should change. |
| `line_out_of_range` | `line` outside the doc. | Use `lineCount` from the fetch response (or re-fetch). |
| `range_out_of_range` | `from`/`to` outside the doc. | Re-fetch; consider `to: -1`. |
| `overlapping_line_ops` | Two line-addressed (or heading-addressed) ops in the batch overlap. | Combine into one `replaceLineRange`/`replaceSection`, or split into two batches. |
| `heading_not_found` | `headingPath` didn't match any heading. | Re-fetch and check the actual heading text (case, whitespace, surrounding formatting). The full path is echoed back in `headingPath`. |
| `ambiguous_heading` | `headingPath` matched > 1 heading. | Add a parent or sibling component to disambiguate; the response includes `matchCount`. |

`failedAt` is the index of the failing op in `ops`. Earlier ops have NOT been applied — fix only the failing op and retry.

### Stale-write error (412)

Separate from resolution errors: if you sent `If-Match` and the doc has been modified since, the server returns **412** with `{error: "revision_mismatch", currentRevisionId}`. Re-fetch and retry.

### Limits

- 1 MB cap on the request body and the resulting document.
- Empty `ops` array — 400.
- Same auth as upload.

### Shell trap

Pipe responses straight to `jq`, or capture with `RESP=$(curl ...)` then `printf '%s' "$RESP" | jq`. Don't use `echo "$RESP" | jq` in zsh or dash — those shells' `echo` interprets escape sequences in the variable, turning `\n` in the response into real newlines and breaking the JSON. Bash's `echo` is fine, but `printf '%s'` is portable.

## Cross-document edits

`POST /api/agent/edits` applies edits to several docs in one call. Reach for it on fan-out tasks: rename a term everywhere it appears, append a footer to every doc of a kind, fix one typo across a set.

```bash
curl -sS -X POST https://md.niftymonkey.dev/api/agent/edits \
  -H "Authorization: Bearer $MD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      {"slug": "aB3xK9pQ", "ops": [{"type": "replace", "find": "old term", "replace": "new term", "replaceAll": true}]},
      {"slug": "zT7mN2wL", "ops": [{"type": "replace", "find": "old term", "replace": "new term", "replaceAll": true}]}
    ],
    "summary": "rename old term to new term"
  }'
```

Body shape: `{operations: [{slug, ops}], summary?: string|null, dryRun?: boolean}`. Each entry's `ops` follows the same rules as the single-doc API (every op type, snapshot-vs-running resolution, setContent exclusivity). A slug may appear at most once per request. `summary` is recorded on every written doc's revision. `dryRun: true` previews every doc without writing any.

**Per-document atomic, batch best-effort.** Each doc's ops all land in one revision or none do. A failure on one doc does not roll back or block the others, so the request returns **200** with a per-doc `results` array rather than one overall status:

```json
{
  "results": [
    {"slug": "aB3xK9pQ", "status": "ok", "doc": {"slug": "aB3xK9pQ", "content": "..."}, "revisionId": "rv_..."},
    {"slug": "zT7mN2wL", "status": "error", "error": "no_match", "failedAt": 0, "query": "old term"}
  ]
}
```

A 200 does not mean every doc changed. Inspect every entry:

| `status` | Fields | Meaning |
|---|---|---|
| `ok` | `doc`, `revisionId` | Written. `revisionId` is `null` for a dryRun preview, or for a no-op batch whose ops resolved to identical content (no revision recorded). |
| `error` | `error` plus matching detail fields | This doc was left untouched. See the values below. |

Per-doc `error` values: `not_found` (slug unknown or owned by someone else), `content_too_large` (the result would exceed 1 MB), and every resolution error from the single-doc 409 table (`no_match`, `ambiguous_match`, `line_out_of_range`, `range_out_of_range`, `overlapping_line_ops`, `heading_not_found`, `ambiguous_heading`) carrying the same `failedAt` and detail fields.

Request-level problems fail the whole call before any doc is touched: malformed JSON, a missing or empty `operations` array, a malformed op (400, naming the offending `operations[i]`), a duplicate slug (400), more than 50 docs (400), or a declared body over 4 MB (413). 401 if unauthenticated.

`If-Match` optimistic concurrency is single-doc only. The batch endpoint does not accept it; when a write must be guarded against an intervening change, edit that doc through `POST /api/agent/docs/<slug>/edits` with `If-Match`.

## Search

`GET /api/agent/search?q=<query>` finds owned docs whose content matches `q` and returns per-match contexts (line, column, surrounding lines). Use this before edits when you don't already know which slug to touch.

```bash
curl -sS "https://md.niftymonkey.dev/api/agent/search?q=needle" \
  -H "Authorization: Bearer $MD_API_KEY"
```

Query params: `q` (required, non-empty), `limit` (optional, default 20, max 100).

Response shape:

```json
{
  "docs": [
    {
      "slug": "abc",
      "title": "Title",
      "kind": "essay",
      "tags": ["foo"],
      "matchCount": 7,
      "matches": [
        {
          "line": 47,
          "column": 1,
          "previewLines": [
            {"line": 46, "text": "..."},
            {"line": 47, "text": "..."},
            {"line": 48, "text": "..."}
          ]
        }
      ]
    }
  ]
}
```

- **Two-stage matching.** Full-text search narrows the candidate docs, then a literal substring scan extracts per-match contexts. A doc surfaces only if `q` appears literally in its content; case-sensitive (matching the single-doc `replace` op). Stem-only or case-mismatch hits drop out.
- **`matchCount` is the true total**; `matches[]` is capped at 5 per doc, with one line of context on either side. Same `{line, column, previewLines}` shape the edits endpoint uses for `ambiguous_match`.
- **Owner-scoped.** Only docs uploaded under the calling token's owner are visible.
- **No cursor pagination.** Tighten `q` or raise `limit` (max 100). For broad listing, use `/api/list?search=` instead.

Errors: 400 if `q` is missing, empty, or whitespace-only. 401 if unauthenticated.

## List

```bash
# 20 most-recent docs (default)
curl -sS https://md.niftymonkey.dev/api/list \
  -H "Authorization: Bearer $MD_API_KEY"

# Pagination — pass nextCursor from prior response
curl -sS "https://md.niftymonkey.dev/api/list?limit=10&cursor=<nextCursor>" \
  -H "Authorization: Bearer $MD_API_KEY"

# Full-text search (no cursor pagination on search results)
curl -sS "https://md.niftymonkey.dev/api/list?search=mermaid" \
  -H "Authorization: Bearer $MD_API_KEY"

# Filter by kind (exact match)
curl -sS "https://md.niftymonkey.dev/api/list?kind=essay" \
  -H "Authorization: Bearer $MD_API_KEY"
```

Response: `{docs: [{id, slug, title, kind, createdAt}, ...], nextCursor: string | null}`. Owner-scoped — only docs uploaded under the calling token's owner are visible. `kind` and `search` can be combined; `kind` works with cursor pagination, `search` does not.

## Delete

```bash
curl -sS -X DELETE https://md.niftymonkey.dev/api/docs/<slug> \
  -H "Authorization: Bearer $MD_API_KEY"
```

Returns 204 on success, 404 if the slug is unknown.

## Output to user

After a successful upload, return the URL plainly so the user can copy it:

```
Uploaded → https://md.niftymonkey.dev/v/aB3xK9pQ
```

Don't dump full JSON unless asked. Surface non-2xx errors verbatim so the user sees the exact reason.

## Notes

- `md.niftymonkey.dev` is the canonical host. View URLs (`/v/<slug>`) are public, no auth required — share freely.
- One personal token from `/settings` covers upload, fetch, edit, delete, and list.
- Tokens are owner-scoped: list and dashboard views only show docs uploaded under that token's owner.
