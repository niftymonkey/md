# Plan: md.niftymonkey.dev (v1)

> Source PRD: [`./exploration.md`](./exploration.md)

## Architectural decisions

Durable decisions that apply across all phases. Sourced from PRD; not subject to re-litigation during implementation.

- **Stack**: Next.js 16 App Router (Turbopack dev), TypeScript, Tailwind v4, shadcn UI, pnpm. Mirrors `brief`.
- **Repo**: standalone at `~/dev/niftymonkey/md/`. App code under `src/`. Configs at repo root so a future `git mv` to `apps/web/` is clean if a browser extension is added.
- **Hosting**: Vercel. Custom domain `md.niftymonkey.dev` (subdomain of existing Vercel-managed `niftymonkey.dev`).
- **Database**: Vercel Postgres (Neon-backed) — `pg_trgm` extension enabled.
- **Auth**:
  - **UI**: WorkOS AuthKit (`@workos-inc/authkit-nextjs`), session cookie. Email allowlist gate (operator's email only for v1).
  - **API**: static `MD_API_KEY` bearer token via env var. Auth handler abstracted (`requireApiAuth`) so future swap to hashed personal-token table is one file.
  - **Endpoints accept either**: `/api/upload` and `/api/docs/[slug]` accept *either* a valid `MD_API_KEY` bearer header *or* a WorkOS session cookie. UI uses session; curl/agents use bearer.
- **Routes**:
  - `/` — auth-gated upload + recent-docs page.
  - `/v/[slug]` — public view, server-rendered.
  - `/api/upload` — POST.
  - `/api/docs/[slug]` — DELETE in v1; PATCH reserved for future edit endpoint.
  - `/auth/*`, `/callback` — WorkOS routes (mirror `brief`).
- **Slug**: nanoid 8-char. `id uuid PRIMARY KEY` separate from `slug text UNIQUE`.
- **Schema**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE TABLE docs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    owner_id text NOT NULL,
    title text,
    content text NOT NULL,
    search_text text,
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
- **Listing function contract** (C-ready from day 1): `listDocs({ ownerId, search?, cursor?, limit = 20 }) → { docs, nextCursor }`. v1 callers pass only `{ ownerId, limit: 20 }`.
- **Renderer pipeline**: `react-markdown` + `remark-gfm` + `rehype-shiki` (dual themes via `prefers-color-scheme`) server-side; mermaid client-hydrated only where present.
- **Title resolution**: explicit (`X-Title` header / `title` JSON field) → first H1 → "Untitled".
- **Upload payload**: same endpoint sniffs `Content-Type`. `text/markdown` → raw body is content. `application/json` → `{content, title?}`.
- **Upload response**: `{slug, viewUrl, id, title, createdAt}` JSON. `Accept: text/plain` returns just the URL.
- **Limits / validation**: 1MB content cap. Empty/whitespace-only uploads → 400.
- **Public view metadata**: title + description (first ~157 chars of `search_text`) + `og:type=article` + Twitter card. `robots: { index: false, follow: false }`. No `og:image` v1.
- **Theme**: page chrome auto via `prefers-color-scheme` (Tailwind `dark:` variants), no toggle UI.
- **Mobile**: fully responsive v1.
- **Migrations**: copy `brief`'s `pnpm migrate <file>` + `scripts/migrate.ts` runner.
- **CORS**: disabled (same-origin only).
- **Submit flow (UI)**: stay on `/`, toast with copy button + view link, `router.refresh()` to re-render the recent-docs list.
- **API-uploaded `owner_id`**: env var `MD_API_OWNER_ID` (= operator's WorkOS user id).

---

## Phase 1: Foundation — deploy, auth, DB

**User stories**: operator can sign in to a deployed `md.niftymonkey.dev`; site rejects non-allowlisted emails; the deployed app can read from Postgres.

### What to build

Bootstrap the repo, provision Vercel project + Postgres + WorkOS app, wire DNS, and ship a hello-world authed page that proves the full deploy + auth + DB stack works end-to-end against the production URL. No domain logic yet — this is the infrastructure tracer.

Includes scaffolding tasks: `.env.example`, README, favicon, `pnpm migrate` runner copied from `brief`, base layout with Tailwind v4 + shadcn primitives, WorkOS routes (`/auth/*`, `/callback`).

### Acceptance criteria

- [ ] `~/dev/niftymonkey/md/` exists as a Next.js 16 + TypeScript + Tailwind v4 + pnpm repo, all configs at root, all app code under `src/`.
- [ ] Vercel project created, linked, deployed; `md.niftymonkey.dev` resolves with valid TLS.
- [ ] Vercel Postgres provisioned and connected via env; `pg_trgm` extension enabled.
- [ ] `pnpm migrate` runner ported from `brief` and verified working against the new DB (no migrations to run yet, but the script accepts `<file>` and connects).
- [ ] WorkOS application configured with prod callback URL (`https://md.niftymonkey.dev/callback`); `@workos-inc/authkit-nextjs` wired into the app.
- [ ] Email allowlist gate active (operator's email only); other emails get a "not authorized" response.
- [ ] Visiting `/` while signed out redirects to WorkOS login; after login, lands on `/`.
- [ ] `/` renders a placeholder page that runs a `SELECT 1` against Postgres at request time and proves DB connectivity (the result need not be displayed; a console log or trivial render is enough).
- [ ] `.env.example` enumerates every required var: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD`, `POSTGRES_URL`, `MD_API_KEY`, `MD_API_OWNER_ID`, `ALLOWED_EMAILS`.

---

## Phase 2: Tracer bullet — API upload + public view

**User stories**: a curl invocation (or agent) with a valid API key uploads MD content and receives a public URL; opening that URL anonymously renders the doc with full GFM, syntax-highlighted code, and mermaid diagrams; pasting the URL into Slack/Discord unfurls with title and description.

### What to build

The end-to-end content path. Run the full schema migration. Implement the upload API with both content-types, key auth, slug generation, title resolution, size cap, empty rejection, and `search_text` derivation. Implement the public view page with the full renderer pipeline, OG metadata, and `noindex` headers. After this phase, programmatic clients are fully served and shared URLs unfurl correctly. No operator UI yet.

### Acceptance criteria

- [ ] First migration file applied; `docs` table + indexes + trigger present in DB.
- [ ] `POST /api/upload`:
  - [ ] Returns 401 without `MD_API_KEY` bearer (and without a valid session cookie — though sessions only matter once Phase 3 lands; in Phase 2 only the bearer path is exercised).
  - [ ] Accepts `Content-Type: text/markdown` raw body; uses body as `content`.
  - [ ] Accepts `Content-Type: application/json` with `{content, title?}`.
  - [ ] Resolves title: explicit field/header > first `# H1` in content > `"Untitled"`.
  - [ ] Rejects empty/whitespace-only content with 400.
  - [ ] Rejects content > 1MB with 413.
  - [ ] Generates an 8-char nanoid slug, retrying on the rare collision.
  - [ ] Strips MD into `search_text` and writes both `content` and `search_text`; trigger populates `search_vector`.
  - [ ] Stamps `owner_id = MD_API_OWNER_ID` on bearer-authed inserts.
  - [ ] Returns JSON `{slug, viewUrl, id, title, createdAt}` by default; returns plain-text URL when `Accept: text/plain`.
- [ ] `GET /v/[slug]`:
  - [ ] Public, no auth required.
  - [ ] Returns 404 for unknown slug.
  - [ ] Server-renders MD via `react-markdown` + `remark-gfm` + `rehype-shiki` (dual themes: light + dark, switched by `prefers-color-scheme`).
  - [ ] Mermaid blocks hydrate client-side and render as SVG.
  - [ ] `generateMetadata` emits `<title>`, `og:title`, `og:description` (first ~157 chars of `search_text`), `og:type=article`, Twitter card, and `robots: noindex, nofollow`.
- [ ] Demoable end-to-end: `curl --data-binary @sample.md -H "Content-Type: text/markdown" -H "Authorization: Bearer $MD_API_KEY" https://md.niftymonkey.dev/api/upload` returns a URL; visiting that URL anonymously shows the rendered doc; pasting the URL into Slack unfurls with title + description.

---

## Phase 3: Operator UI — upload + listing

**User stories**: operator drag-drops or pastes or file-picks an MD file in a browser, sees a toast with the URL on success and the new doc at the top of the recent list; operator scrolls a list of their recent uploads and can click to view any of them; UI works on a phone.

### What to build

The auth-gated `/` page becomes a real upload + listing UI. Three input modalities (drag-drop populating the textarea, paste, file picker) feed a single submit handler that POSTs to `/api/upload` using the session cookie. Success surfaces a toast with copy + view actions and triggers `router.refresh()` to re-render the server-rendered recent-docs list below. The list calls `listDocs({ ownerId, limit: 20 })` (function signature is full C-ready shape from day 1; v1 just doesn't pass `search` or `cursor`). Mobile-responsive layout, auto dark/light via `prefers-color-scheme`. Logout button.

`/api/upload` gains the session-auth path so the UI can call it; bearer path from Phase 2 keeps working unchanged.

### Acceptance criteria

- [ ] `/` (signed in) renders: header with logout, drag-drop + textarea + "Choose file" input, submit button, recent-docs list of 20 most-recent owner docs (title, created date, view link).
- [ ] Drag-drop accepts `.md`/`.markdown`/`text/markdown`; rejects others with inline error; on accept, file contents populate the textarea (does not auto-submit).
- [ ] File picker has the same accept filter and same populate behavior.
- [ ] Submit handler POSTs to `/api/upload` as JSON `{content, title?}` using session auth; bearer is not exposed to the browser.
- [ ] Success → toast renders with the `viewUrl`, a "Copy" button (copies to clipboard), and a "View" link (opens `/v/<slug>`); page stays on `/`; `router.refresh()` re-renders the list with the new doc at top.
- [ ] Failure → toast renders the error message (oversize, empty, network).
- [ ] `/api/upload` accepts a valid WorkOS session cookie as an alternative to the bearer; session-authed inserts stamp `owner_id` from the WorkOS user id.
- [ ] Layout is responsive: single-column at mobile widths, drop zone usable via touch (file picker substitutes for drag).
- [ ] All page chrome respects `prefers-color-scheme` via Tailwind `dark:` variants.
- [ ] Demoable end-to-end: drag a `.md` file onto `/`, see toast with copy/view, click view to confirm rendered output, return to `/` and see the doc at the top of the list.

---

## Phase 4: Delete

**User stories**: operator removes a junk upload from the UI; agent removes a programmatically-uploaded doc via curl.

### What to build

Symmetric delete via API and UI. `DELETE /api/docs/[slug]` accepts either bearer or session, removes the row, returns 204. UI list rows get a trash icon → confirm prompt → call DELETE → `router.refresh()`.

### Acceptance criteria

- [ ] `DELETE /api/docs/[slug]` returns 401 without bearer or session.
- [ ] Returns 404 for unknown slug.
- [ ] Returns 204 on success and the row is gone from `docs`.
- [ ] Each row in the recent-docs list has a trash icon; clicking prompts for confirmation; confirming calls DELETE and refreshes the list.
- [ ] Demoable end-to-end: upload a doc, delete it via UI trash icon, confirm it disappears from the list and `/v/<slug>` returns 404. Repeat via curl.
