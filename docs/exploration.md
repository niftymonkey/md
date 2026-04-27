# md.niftymonkey.dev — Implementation Brief

## Problem / Opportunity

Markdown has no universal viewer. Sharing rendered MD currently requires either ad-hoc tools (gists, paste services) or pasting raw MD into a chat where it half-renders. A personal "upload MD → get a shareable link to a rendered version" service eliminates this friction — and serves as a starter app whose patterns can be extended into something larger.

## Target Users

- **Primary (v1):** the operator (single user, gated by email allowlist).
- **Programmatic clients:** curl from terminal, AI coding agents — both authenticated via static API key.
- **View audience (unauthed):** anyone with a `/v/<slug>` URL.

## Core Requirements

### Must-have (v1, ship tonight)
- Drag-drop file OR paste-into-textarea upload UI (drop populates the textarea).
- Public, unauthed view URL: `https://md.niftymonkey.dev/v/<slug>`.
- API endpoint that accepts both raw `text/markdown` body and `application/json` `{content, title?}`, gated by static `MD_API_KEY` bearer token.
- UI auth via WorkOS AuthKit (mirrors brief), email allowlist gate.
- Full GFM rendering (tables, task lists, strikethrough, etc.) + Shiki syntax highlighting (auto light/dark via `prefers-color-scheme`) + client-hydrated mermaid diagrams.
- 1MB upload cap, enforced API-side and shown in UI.
- Title resolution: explicit (`X-Title` / `title` field) → first H1 → "Untitled".
- Upload response: `{slug, viewUrl, id, title, createdAt}` JSON; `Accept: text/plain` returns just the URL.
- Open Graph tags for unfurling (title + description, no `og:image` v1); `noindex, nofollow` on view pages.
- Listing page: 20 most-recent owner docs, drag-drop/paste box on the same page.
- Delete: `DELETE /api/docs/:slug` (API-key auth) + trash icon in UI list (session auth).
- Reject empty/whitespace-only uploads (400).

### Nice-to-have (very near future, schema must already support)
- Edit existing docs (UI + API). Schema and triggers already auto-update `search_vector` on UPDATE.
- Full search UI with FTS + fuzzy fallback. `search_vector` (GIN) and `pg_trgm` trigram index on `title` are built day 1; only the query/UI is deferred.
- Pagination (cursor-based on `(created_at, id)`). Listing function already accepts `cursor` param; UI doesn't pass it yet.
- `og:image` rendered via Next.js `opengraph-image.tsx`.
- Per-doc indexing toggle if you want individual docs Google-indexable.
- Personal API token table (replacing static `MD_API_KEY`) — auth handler abstracted so swap is one file.

## Key Decisions Made

| # | Decision | Choice |
|---|---|---|
| 1 | Storage | Vercel Postgres only (TEXT column for content) |
| 2 | API auth | Static `MD_API_KEY` env var bearer token; UI auth = WorkOS session; mutating endpoints accept *either* on same handler |
| 3 | Slug | nanoid 8-char, separate `id uuid PK` + `slug text UNIQUE` for future reslug/alias |
| 4 | Ownership | `owner_id` on every doc from day 1; v1 doesn't enforce edit-permission yet |
| 5 | Repo | Standalone (`~/dev/niftymonkey/md/`), structured for clean monorepo conversion later |
| 6 | Renderer | `react-markdown` + `remark-gfm` + `rehype-shiki` SSR; mermaid client-hydrated |
| 6b | Theme | Auto via `prefers-color-scheme`, dual Shiki themes |
| 7a | Size cap | 1MB |
| 7b | API payload | Both raw `text/markdown` and JSON, sniffed by `Content-Type` |
| 7c | Title source | Explicit → first H1 → "Untitled" |
| 7d | Response | Full JSON `{slug, viewUrl, ...}`; plain-text URL with `Accept: text/plain` |
| 7e | Listing v1 | 20 most-recent (B); data layer C-ready (search/cursor params accepted) |
| 7f | Delete | API + UI, day 1 |
| 7g | OG | Title + description; `noindex, nofollow`; `og:image` deferred |
| 8a | Migrations | Copy brief's `pnpm migrate <file>` + `scripts/migrate.ts` |
| 8b | Local dev | Mirror brief's `.env.local` flow |
| 8c | Sign-in gate | Email allowlist (your email only v1) |
| 8d | API-uploaded ownership | Hardcoded to your WorkOS user id via `MD_API_OWNER_ID` |
| 8e | Empty uploads | Reject 400 |
| 8f | Dedup | None — duplicate content = duplicate rows |
| 8g | CORS | Disabled (same-origin only) |
| 9a | Submit flow | Toast w/ copy + view-link, stay on `/`, list refreshes via `router.refresh()` |
| 9b | File input modalities | Drag-drop + paste textarea + "Choose file" button |
| 9c | Page chrome theme | Auto via `prefers-color-scheme` (Tailwind `dark:` variants), no toggle UI |
| 9d | Mobile support | Fully responsive v1 |
| 9e | Deploy timing | Vercel project + `md.niftymonkey.dev` DNS wired before code; WorkOS configured against prod URL from start |

## Schema (v1)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  owner_id text NOT NULL,
  title text,
  content text NOT NULL,           -- raw MD, rendered
  search_text text,                -- MD-stripped, indexed only
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_search ON docs USING gin(search_vector);
CREATE INDEX idx_docs_owner_created ON docs(owner_id, created_at DESC);
CREATE INDEX idx_docs_title_trgm ON docs USING gin(title gin_trgm_ops);

CREATE OR REPLACE FUNCTION docs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.search_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_search_vector_trigger
  BEFORE INSERT OR UPDATE ON docs
  FOR EACH ROW EXECUTE FUNCTION docs_search_vector_update();
```

## Architecture

- **Repo:** standalone Next.js 16 App Router app, Turbopack dev. All app code under `src/`.
- **Route groups:**
  - `/` — auth-gated upload + recent-docs page (WorkOS session).
  - `/v/[slug]` — public view, server-rendered.
  - `/api/upload` — POST, `MD_API_KEY` auth (or session for UI calls), accepts MD or JSON.
  - `/api/docs/[slug]` — DELETE (API key or session), future PATCH for edit.
  - `/auth/*`, `/callback` — WorkOS routes (mirror brief).
- **Listing function signature (C-ready):** `listDocs({ ownerId, search?, cursor?, limit = 20 }) → { docs, nextCursor }`. v1 page calls only with `{ownerId, limit:20}`.
- **Auth handler abstraction:** `requireApiAuth(req)` checks bearer token; today compares to `MD_API_KEY`; future swap to hashed-token table is one file.
- **Dual-auth on mutating endpoints:** `/api/upload` and `/api/docs/[slug]` accept *either* a valid `MD_API_KEY` bearer header *or* a WorkOS session cookie on the same handler. UI uses session (bearer never exposed to browser); curl/agents use bearer. The shared `requireAuth(req)` resolves whichever is present and returns the `owner_id` to stamp on the row (session → WorkOS user id; bearer → `MD_API_OWNER_ID` env var).
- **API-key uploader's `owner_id`:** sourced from env `MD_API_OWNER_ID` (= your WorkOS user id).

## Constraints / Boundaries

- 1MB upload cap.
- Vercel function body limit (4.5MB hobby) — well above cap.
- Vercel Postgres hobby tier (256MB) — plenty for thousands of docs.
- No CORS — API not callable from third-party browser apps.
- No multi-tenant in v1 (allowlist of one).
- v1 has no edit endpoint, no search UI, no pagination UI — but data layer fully supports all three with no migration.

## Deferred Work (Decisions Pre-Made)

None blocking v1. Decisions locked so future PRs are mechanical:

### Edit endpoint (`PATCH /api/docs/:slug`)
- **Auth:** API key alone for v1.x; add `owner_id` check the moment personal tokens land.
- **Editable fields:** `content` and `title` (explicit override). Either change rebuilds `search_text` + `search_vector` via existing trigger.
- **Slug:** immutable on PATCH. Renaming is a separate future endpoint when user-chosen slugs land.
- **Concurrency:** last-write-wins. Add `If-Match`/ETag only if collisions actually occur.
- **Revisions:** none. Add `doc_revisions` table only when "restore prior version" is a real need.

### Search UI + query logic
- Index already in place (GIN on `search_vector` + trigram on `title`).
- Decisions still open — to be made when search UI is scoped.

### Pagination UI
- `listDocs` already accepts `cursor`. UI just doesn't pass it.
- Cursor format: base64 of `(created_at, id)` keyset.
- Decisions still open — to be made when pagination UI is scoped.

### `og:image` generation
- Decisions still open.

### Personal API tokens (replacing shared `MD_API_KEY`)
- Decisions still open.

### Browser extension
- Triggers monorepo conversion: `git mv` repo into `apps/web/`, add root `package.json` + `pnpm-workspace.yaml`. App code at `src/` root makes this clean.
