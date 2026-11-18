<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Troubleshooting

## "A tree hydrated but some attributes didn't match" (hydration mismatch)

Before changing component code, check whether the report is actually a stale browser tab:

1. `npm run dev` and load the page in a fresh tab (or hard reload with `Ctrl + Shift + R`).
2. Compare the server HTML with the current source, e.g. `Invoke-WebRequest -UseBasicParsing http://localhost:3000/` and inspect the classes/props in the error's diff.
3. If a fresh load logs no errors and the server HTML matches the file on disk, the mismatch came from a tab holding an older document/JS across a dev-server restart or a file edit. A hard reload or **DevTools → Application → Clear site data** fixes it — no code change needed.

Only treat it as a real bug when the error reproduces on a clean load. Common real causes in this app: `Date.now()` / `Math.random()` during render, `typeof window` branches in SSR'd client components, and locale-dependent date formatting.

