<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16 + React 19 Project

This project uses Next.js 16.2.7 with React 19.2.4 and Tailwind CSS 4.
All route pages currently use `"use client"` (SPA-style with Firebase).
App Router with route groups `(app)` (authenticated) and `(auth)` (login).

## Key conventions
- Feature-based structure: `src/features/{name}/components|data|hooks|providers`
- Shared components: `src/components/ui/` (Button, Badge, Card, Input, Label, Dialog)
- Shared utilities: `src/lib/` (parsing.ts, utils.ts, permissions/, firebase/, routes/)
- Tests: Vitest + Testing Library, run with `npm test`
- CI: `npm run typecheck && npm run lint && npm test`
- Migration scripts live in `tools/` (require firebase-admin, run locally only)
<!-- END:nextjs-agent-rules -->
