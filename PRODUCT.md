# Product

## Register

product

## Users

The operator (one person, allow-listed) publishes markdown via the UI or the `/api/upload` endpoint, then sends the resulting `/v/<slug>` link to a recipient. Two recipient classes:

1. **Friends and peers, ad-hoc.** A link in a DM or chat. Recipient already trusts the sender, opens once, reads, closes the tab. May or may not look at the URL.
2. **Devs and AI agents.** Outputs from Claude or other agents using the `md-upload` skill, shared back to a human reviewer. Technical readers, often skimming code blocks, mermaid diagrams, or short technical notes.

The job to be done: turn a markdown file into a legible, shareable URL faster than spinning up a gist and more durable than a paste-bin, with rendering quality that holds up for prose and code alike.

## Product Purpose

A personal markdown share service. The operator owns publishing; the public gets read-only access via `/v/<slug>` and `/api/raw/<slug>`. Success is when a recipient reads the doc, gets the point, and never thinks about the tool.

## Brand Personality

Sharp, technical, dry.

- **Voice.** Plain and exact. Dry wit allowed in micro-copy. No exclamation points. Never apologize for the tool, never explain itself unprompted.
- **Reference lane.** Linear / Raycast adjacent: restrained color, considered typography, mono accents, tight rhythm. The discipline is what to borrow, not the palette.

## Anti-references

- **SaaS landing-page tropes.** Big-number hero, supporting-metric blocks, gradient accents, identical card grids, glassmorphism, "trusted by" logo strips.
- **Notion / Medium clones.** Big serif headers in a narrow column, blockquote-heavy stylings that signal "blog platform."
- **Over-designed personal portfolio.** Gradient text, scroll-jacking, mouse-trail effects, "look, a designer" energy.
- **Generic dev-tool category reflex.** Dark blue + neon accent + Inter on near-black. The thing every Vercel-stack share tool defaults to. Avoid even when it would look fine.

## Design Principles

1. **Content is the product.** Chrome serves the markdown. Every chrome element answers "does this make the doc easier to read or share?" If not, remove it.
2. **Resist the category reflex.** When a Vercel-stack share-tool answer feels obvious (zinc-950, Inter, default system-dark, accent-blue), pick the next-most-honest option instead. Borrow Linear's discipline, not its palette.
3. **Both themes get equal craft.** Light and dark are designed scenes with their own physical context, not inverted neutrals. Each must hold up for sustained reading of prose and code.
4. **Tool, not portfolio.** Quietly distinctive. If a recipient asks "what is this?" the design won. If they say "wow, look at this," it overreached.
5. **Earn every word.** UI copy is sparse and exact. No restated headings, no platitudes, no em dashes, no `--`.

## Accessibility & Inclusion

- **WCAG 2.2 AA** contrast across both themes for body text, headings, links, and code.
- `prefers-reduced-motion` respected by default. Never animate critical content; transitions only on hover, focus, and disclosure states.
- Focus rings legible against every surface, both themes.
- Code-block syntax highlighting (Shiki `github-light` / `github-dark`) must stay readable for protan/deutan/tritan vision. Verify on palette changes.
- Sticky elements (the reader outline rail header today; any future sticky chrome) must not trap keyboard focus or break "skip to content" flows.
