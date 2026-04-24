# packages/shared

This package is reserved for runtime-neutral helpers shared across the workspace.

Planned contents:

- constants shared across server and client
- environment parsing helpers that do not depend on app runtime boundaries
- time and date helpers
- display and formatting helpers that are not browser-only

This package may depend on `packages/contracts`, but must not depend on app packages.
