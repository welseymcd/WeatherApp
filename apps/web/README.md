# apps/web

This app will own the user-facing React experience built with Vite, Tailwind CSS, shadcn/ui, TanStack Router, and tRPC client bindings. It should be built as static assets served by the Cloudflare Worker deployment.

Planned subdirectories:

- `src/routes`: TanStack Router route files
- `src/app`: top-level providers and app shell wiring
- `src/components/ui`: shadcn/ui primitives
- `src/components/layout`: shared layout components
- `src/features/weather`: forecast and observation views
- `src/features/locations`: location entry and selection flows
- `src/features/history`: historical snapshot browsing UI
- `src/lib/trpc`: client and provider setup
- `src/lib/router`: router composition helpers
- `src/lib/utils`: browser-safe utilities
- `src/styles`: global styles and theme entrypoints
