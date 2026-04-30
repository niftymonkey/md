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
