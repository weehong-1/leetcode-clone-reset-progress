# shared

Cross-cutting TypeScript contracts imported by **both** `client/` and `server/`
via the `@shared` alias (e.g. `import type { HealthResponse } from "@shared"`).

## Type-only — for now

`@shared` resolves at **build time** for the client (Vite alias) and at
**type-check time** for the server (tsconfig `paths`), but it is **not** resolved
at runtime by `tsx`. Keep everything here **type-only** and import it with
`import type { … }` so it is erased from the compiled output and needs no runtime
resolver.

When `shared` later needs runtime values (e.g. Zod schemas for request/response
validation), switch to one of:

- Node subpath imports — add `"imports": { "#shared/*": "./shared/src/*" }` to
  the root `package.json` and import `#shared/...` (resolved by Node/`tsx`).
- A build step that compiles `shared` to `dist` and imports the output.
