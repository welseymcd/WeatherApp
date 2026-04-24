# packages/client-runtime

This package is reserved for browser-safe runtime helpers shared by the web app.

Planned contents:

- query helper factories
- location serialization helpers
- response formatting helpers that are safe to run in the browser
- thin client adapters that depend only on contracts and shared utilities

This package should not depend on server implementation code.
