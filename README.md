# md

Upload Markdown, get a shareable rendered link. Lives at [md.niftymonkey.dev](https://md.niftymonkey.dev).

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Required env vars are listed in `.env.example`. Copy it to `.env.local` and fill in values.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Vercel Postgres (Neon-backed) + `pg_trgm` for full-text + fuzzy search
- WorkOS AuthKit (`@workos-inc/authkit-nextjs`) for UI auth
- `react-markdown` + `remark-gfm` + `rehype-shiki` for rendering
- Mermaid (client-hydrated) for diagrams

## API

The bearer credential is a personal API token generated from `/settings` after signing in. Each token is shown only at creation; the server stores a sha256 hash. Lost tokens can be revoked and replaced but not recovered.

Export your token in the shell:

```bash
export MD_API_KEY=mdk_...
```

Upload via curl:

```bash
curl --data-binary @doc.md \
  -H "Content-Type: text/markdown" \
  -H "Authorization: Bearer $MD_API_KEY" \
  https://md.niftymonkey.dev/api/upload
```

Or JSON:

```bash
curl -d '{"content":"# hello","title":"My Doc"}' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MD_API_KEY" \
  https://md.niftymonkey.dev/api/upload
```

Add `Accept: text/plain` to get just the URL on stdout (pipe-friendly).

## Claude Code skill

Anyone using Claude Code can publish, fetch, and edit markdown on md.niftymonkey.dev through a single skill — no curl recipes required. The skill teaches the full AI-First API: upload, fetch, full-replace PATCH, the targeted ops API (find/replace, line-addressed edits, heading-addressed `replaceSection`, full-doc `setContent`), `dryRun` previews, `If-Match` optimistic concurrency, and the structured 409 / 412 error shapes.

The repo ships the skill at `.claude/skills/md-niftymonkey/SKILL.md`. The same content is published at `https://md.niftymonkey.dev/api/raw/80zOpiWz` and stays in sync via CI on every push to `main` that touches the skill.

### Install (one curl)

Pulls the published version into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills/md-niftymonkey
curl -sS https://md.niftymonkey.dev/api/raw/80zOpiWz \
  > ~/.claude/skills/md-niftymonkey/SKILL.md
```

### Install (from a clone)

If you already have the repo checked out:

```bash
mkdir -p ~/.claude/skills/md-niftymonkey
cp .claude/skills/md-niftymonkey/SKILL.md \
   ~/.claude/skills/md-niftymonkey/
```

### Token

Both flows need a personal API token from `https://md.niftymonkey.dev/settings`. The skill expects it in `MD_API_KEY` in your shell environment.
