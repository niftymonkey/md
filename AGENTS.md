<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pre-hydration UI state (avoiding flash-of-wrong-state)

When a piece of UI depends on a value only the client knows (`localStorage`, `prefers-color-scheme`, etc.) and that value affects layout, visibility, or visual state, follow this pattern. Skipping any step reintroduces the flash.

1. **Inline script via `next/script` with `strategy="beforeInteractive"`** in `src/app/layout.tsx` reads the value synchronously and sets a `data-*` attribute on `<html>`. Next.js hoists the script content into the document `<head>` and executes it before hydration / first paint, while keeping it out of React's render tree (avoids the React 19 "Encountered a script tag while rendering React component" dev warning that fires for raw `<script dangerouslySetInnerHTML>` children).
2. **CSS keyed on the data attribute** drives the visible difference: `display`, custom-property values (`--md-article-max`), color tokens, etc. First paint is correct.
3. **Server renders every state.** When a UI region differs based on a flippable setting, render all variants in JSX and let CSS hide the wrong one. Do not gate the initial JSX on React state — that state defaults to the server-render value, then flips after `useEffect` reads `localStorage`, which is the flash.
4. **Do not derive visuals from React state** for things step 3 controls. If a component only appears in one logical state (e.g., a "Show outline" button that only renders when the outline is hidden), hardcode its visual props rather than reading state that will flip post-hydration.
5. **Add `suppressHydrationWarning` to `<html>`** because the inline script mutates attributes the server didn't emit. The directive is element-scoped — it does not silence warnings on descendants.

Current keys: `data-width` (reading/wide), `data-outline-hidden`, `data-theme` (dev-only switcher). Extend the inline script for new settings; mirror the data-attribute selector pattern in `globals.css`.

Why not `useEffect` / `useLayoutEffect`? `useEffect` runs after first paint, so the wrong state is visible briefly. `useLayoutEffect` does not run during SSR, so the server HTML still reflects the default. Only a synchronous inline script that runs before first paint avoids the flash — `next/script` `beforeInteractive` is one such mechanism.

Why `next/script` instead of a raw `<script dangerouslySetInnerHTML>`? Both produce the same end-state HTML (script in `<head>`, runs before first paint). `next/script` keeps the script out of React's render tree, so React 19 doesn't log the "Encountered a script tag while rendering React component" dev warning. Adding `suppressHydrationWarning` to silence that warning would just hide it without solving the cause; `next/script` solves the cause by moving the element out of React's reconciliation.

If the project ever adopts a strict CSP that blocks inline scripts, switch to cookie-based persistence: read on the server in `layout.tsx`, render `<html data-*="...">` directly. Same data attributes, same CSS, no inline script.
