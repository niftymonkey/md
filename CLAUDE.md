@AGENTS.md

# md.niftymonkey.dev

A personal markdown share service. Upload markdown via UI or API, get back a public URL like `/v/<slug>` that renders the doc with full GFM, Shiki code highlighting, and mermaid. v1 is shipped.

## Where to start (fresh session)

In order:

1. **`docs/exploration.md`** — the PRD with locked decisions for v1 and the deferred-work shapes.
2. **`docs/plan.md`** — original 4-phase plan that built v1; the "Architectural decisions" section at the top is still load-bearing.
3. **Open GitHub issues** — what's left to do; each references the docs above.
4. **`CLAUDE.local.md`** if it exists — operator-specific notes (gitignored, present only on the operator's machine).

## API surface

All endpoints accept either `Authorization: Bearer <personal-token>` (created at `/settings`) or a valid WorkOS session cookie unless marked public. Tokens are stored as sha256 hashes in `api_tokens`; `requireAuth` (in `src/lib/auth.ts`) tries bearer first, then session. Token-management endpoints under `/api/tokens` are session-only — bearer is rejected to prevent token-spawn-from-leaked-token escalation.

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/upload` | bearer or session | Raw `text/markdown` body or JSON `{content, title?}`. Title resolves: explicit → first H1 → "Untitled". 1 MB cap. |
| `DELETE` | `/api/docs/[slug]` | bearer or session | 204 on success, 404 unknown. |
| `PATCH` | `/api/docs/[slug]` | bearer or session | Partial update of `content`, `title`, `kind`. |
| `GET` | `/api/list` | bearer or session | `?limit=` (max 100), `?cursor=`, `?search=`, `?kind=`. Returns `{docs, nextCursor}`, owner-scoped. |
| `POST` | `/api/tokens` | session only | `{name}`. Returns plaintext token once. |
| `GET` | `/api/tokens` | session only | Lists active tokens (no plaintext). |
| `DELETE` | `/api/tokens/[id]` | session only | Sets `revoked_at` on the row. |
| `GET` | `/api/raw/[slug]` | public | `text/markdown` by default; JSON if `Accept: application/json`. |
| `GET` | `/v/[slug]` | public | Server-rendered page with OG metadata + `noindex, nofollow`. |

## Workflow

After v1, all changes go through a feature branch + PR. No direct commits to `main`.

The user's global `~/.claude/CLAUDE.md` carries the broader workflow rules (terse commits, draft issues before creating, test before committing, no personal info in public artifacts, etc.) — read that first; don't duplicate it here.

## Framework note

Next.js 16 has breaking changes from earlier versions. Notably:

- `proxy.ts` replaces `middleware.ts` (rename + new convention)
- `params`, `searchParams`, `cookies()`, `headers()` are async
- Turbopack is the default for `dev` and `build`
- With the `src/` directory layout, the proxy file lives at `src/proxy.ts`, sibling to `app/`

When in doubt, check `node_modules/next/dist/docs/` before writing code that touches these areas.

## Encoding tip for the upload API

When invoking `/api/upload` with an explicit title that contains em-dashes, smart quotes, accents, or emoji, use the JSON request body — never the `X-Title` header. HTTP headers don't reliably carry non-ASCII; the header path double-encodes UTF-8.

## Related artifact

`~/.claude/skills/md-upload/SKILL.md` (user-global, not in this repo). Any Claude session can publish markdown to this app via that skill. If the API surface here changes, update the skill in the same change.
