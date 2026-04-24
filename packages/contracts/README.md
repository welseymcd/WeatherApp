# packages/contracts

This package is the schema-first source of truth for all cross-boundary shapes used by the overlay.

This package contains specification documents and runtime Zod schemas. Keep this package limited to:

- Zod schemas
- inferred types
- transport-safe constants
- public error shapes
- RPC request and response declarations

Do not add business logic, persistence code, HTTP adapters, or UI helpers here.

## Planned Source Layout

- `src/base`: shared primitives such as IDs, timestamps, units, and coordinates
- `src/weather`: upstream-facing normalized weather domain shapes
- `src/overlay`: application-facing overlay request and response shapes
- `src/history`: historical snapshot and audit shapes
- `src/errors`: structured public error contracts
- `src/transport`: shared envelopes and pagination contracts

## Current Specifications

- [Contract Overview](./specs/overview.md)
- [Overlay API Contracts](./specs/overlay-api.md)
- [Storage And History Contracts](./specs/storage-history.md)
