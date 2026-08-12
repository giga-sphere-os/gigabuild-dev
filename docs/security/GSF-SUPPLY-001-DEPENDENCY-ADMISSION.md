# GSF-SUPPLY-001 — dependency admission

The isolated dependency lane updated only the vulnerable transitive paths:

- `@capacitor/cli@8.3.4 -> tar@7.5.15` critical path is pinned to `tar@7.5.21`.
- `@capacitor/cli -> rimraf -> glob -> minimatch -> brace-expansion@5.0.6`
  high path is pinned to `brace-expansion@5.0.9`.

The overrides are exact, same-major, and limited to the reported packages.
`npm ci`, `npm audit --json`, existing tests, and `git diff --check` pass.
No production/provider mutation, broad refresh, or forced audit fix was used.
