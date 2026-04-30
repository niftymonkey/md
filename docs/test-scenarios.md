# Test scenarios

Reference for what behavior to cover when automated tests come online. Each scenario was verified manually via curl against a local dev server during the PR that introduced it; capture them here so we don't regress on them silently.

Until there's a test runner, the curl recipes below are runnable as-is against `http://localhost:3000`. Generate a personal API token at `/settings` and export it as `MD_API_KEY=mdk_...` for the bearer-flow recipes. The local DB is the shared Neon DB until #8 separates environments — be mindful of test data and clean up after yourself.

For ownership scenarios that need a doc owned by a *different* user, insert directly via `@vercel/postgres` from a tsx script (one-off, not committed). Example shape:

```ts
import { config } from "dotenv";
import { sql } from "@vercel/postgres";
config({ path: ".env.local" });
await sql`INSERT INTO docs (slug, owner_id, title, content) VALUES (${slug}, ${otherOwnerId}, 'spoof', '# spoof')`;
```

Cleanup that row afterward — non-owner DELETE from the API will (correctly) return 404 without touching it.

---

## Upload (`POST /api/upload`)

- 201 with bearer auth and `Content-Type: text/markdown` body
- 201 with bearer auth and JSON `{content, title?, kind?}` body
- 400 on empty/whitespace-only content
- 400 on non-string `kind`
- 400 on `kind` over 64 chars
- 413 on body over 1 MB
- 401 on missing/invalid bearer
- Title resolves: explicit override → first H1 → `"Untitled"`
- `X-Title` header honors ASCII titles; UTF-8 (em-dash, accents, emoji) round-trips correctly only via JSON body
- `X-Kind` header normalizes (trim + lowercase) just like JSON body
- Bearer-uploaded docs land under the `owner_id` of the token's row; session-uploaded docs land under `user.id` (typically the same value for an operator with one token)

## Edit (`PATCH /api/docs/[slug]`)

- 200 + updated doc shape on owner PATCH of `content`
- 200 on PATCH of `title` (explicit override sticks)
- 200 on PATCH of `title: null` (re-derives from current H1)
- 200 on PATCH of `content` + `title: null` (re-derives from new H1)
- 200 on PATCH of `kind` (set or clear)
- Title is preserved when only `content` is patched (PATCH only changes what you send)
- 400 on empty body / no field provided
- 400 on empty/whitespace `content`
- 400 on non-string `content`
- 401 on missing/invalid bearer
- 404 on unknown slug
- **404 on owner mismatch** (don't leak existence to non-owners; spoof doc remains untouched in DB)
- 413 on body over 1 MB
- `slug` field in body is silently ignored (slug stays immutable)
- After PATCH: `search_vector` rebuilds — search hits the new term, no longer hits old terms
- After PATCH: `revalidatePath("/")` and `revalidatePath("/v/<slug>")` invalidate caches; next view reflects new content + OG metadata

## Delete (`DELETE /api/docs/[slug]`)

- 204 on owner DELETE
- 401 on missing/invalid bearer
- 404 on unknown slug
- **404 on owner mismatch** (spoof doc remains in DB after the bogus DELETE)

## List (`GET /api/list`)

- 200 with bearer auth, returns `{docs, nextCursor}` owner-scoped to the authenticated user
- `?limit=` clamps to [1, 100], default 20
- `?cursor=` (base64 of `created_at|id`) paginates older-first
- `?search=` runs against `search_vector` (FTS), no cursor pagination on search
- `?kind=` exact match, owner-scoped, composes with `?search=` and `?cursor=`
- 400 on `kind` over 64 chars
- Pre-existing docs with NULL `kind` appear in unfiltered list, absent from `?kind=<value>`

## Raw read (`GET /api/raw/[slug]`)

- Public (no auth) regardless of doc owner
- Default response: `Content-Type: text/markdown; charset=utf-8`, body is raw markdown
- `Accept: application/json` returns `{slug, title, kind, content, createdAt, updatedAt}`
- 404 on unknown slug

## View page (`GET /v/[slug]`)

- Public (no auth) regardless of doc owner
- 200 with rendered HTML, OG metadata, `noindex,nofollow`
- After PATCH on the underlying doc: page reflects updated title/body without manual refresh (server-side `revalidatePath`)

## Edit page (`GET /edit/[slug]`)

- Requires session auth (proxy matcher includes `/edit/:slug*`)
- 307 redirect to `/auth` for unauthenticated requests
- Redirect to `/` for authenticated users not on the email allow list
- **`notFound()` (404) when the authenticated user doesn't own the doc** (don't leak existence)
- Renders form prefilled with title, kind, body
- Save PATCHes only the fields that changed
- Save → `router.push("/v/<slug>")` (silent on success; toasts only on error)

## Cross-cutting

- Bearer and session auth paths both use `requireAuth` and produce the same `auth.ownerId`
- Bearer flow: a sha256 hash of the incoming token is looked up in `api_tokens`; revoked rows (`revoked_at IS NOT NULL`) reject as 401
- Token-management endpoints (`/api/tokens*`) are session-only and reject any non-empty `Authorization` header
- Public endpoints (`/v/<slug>`, `/api/raw/<slug>`) intentionally remain unscoped — shareable URLs are the point
