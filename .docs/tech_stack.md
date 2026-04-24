# Tech Stack

Last updated: 2026-04-24

## Chosen Stack

- TypeScript across the full workspace
- Bun for package management and project scripts
- React in `apps/web`
- Vite for the web build and dev server
- Tailwind CSS for styling
- shadcn/ui for locally owned component primitives
- TanStack Router for route structure and navigation
- tRPC for the application API layer
- Zod for runtime schema validation and inferred API contract types
- Cloudflare Workers for the API overlay, weather.gov sync runtime, and static asset hosting
- Cloudflare Email Service for transactional email from the Worker
- Cloudflare D1 for relational persistence and historical weather snapshots
- Cloudflare Vite plugin for local Worker runtime integration and static asset deployment
- Wrangler for Cloudflare local development, D1 migrations, and deployments
- weather.gov as the upstream source system

## Why This Stack

- TypeScript keeps the server, client, and contracts on one type system.
- Bun is the repo-standard package manager and script runner.
- Vite provides a fast React development loop and explicitly supports monorepo-style out-of-root dependencies.
- Tailwind CSS has a current first-party Vite plugin path.
- shadcn/ui fits a single-web-app monorepo well because components live in the repo instead of behind a package boundary.
- TanStack Router is a strong fit for a route-driven React app and its file-based routing is the recommended path in the current docs.
- tRPC keeps the overlay surface strongly typed without generating a separate client SDK.
- Zod is the shared validation layer for tRPC inputs and transport-safe contracts in `packages/contracts`.
- Cloudflare Workers keeps the weather.gov SDK, sync orchestration, API procedures, and static assets in one production runtime.
- D1 is a good fit for the append-only snapshot model because the project needs relational request keys, sync runs, latest pointers, and queryable history without operating a separate database server.
- The Cloudflare Vite plugin is the current best fit for this app because it targets Workers directly while preserving the React/Vite development flow.
- Wrangler provides one Cloudflare-native toolchain for Worker execution, D1 bindings, local D1, migrations, generated runtime types, and deploys.

## Monorepo Interpretation

- `apps/web` is the only browser app.
- `apps/server` is the Cloudflare Worker API overlay and sync authority.
- `packages/contracts` defines shared request, response, error, and history shapes.
- `packages/shared` holds cross-package runtime utilities.
- `packages/client-runtime` holds browser-safe query and client helpers.

## Deployment

- Production domain: `weather.rmcd.cc`
- Worker route: `weather.rmcd.cc/*`
- Worker name: `wind-app-for-greg`
- D1 database: `wind-app-for-greg`
- D1 binding: `DB`
- Email binding: `EMAIL`
- Email sender: `weather@rmcd.cc`
- Local dev command: `bun run dev`
- Build command: `bun run build`
- Deploy command: `bun run cf:deploy`

## Stack Decisions For This Project

- Keep shadcn/ui inside `apps/web` rather than creating a shared UI package.
- Use TanStack Router file-based routes in `apps/web/src/routes`.
- Use tRPC only between `apps/web` and `apps/server`.
- Define tRPC procedure inputs with Zod schemas exported from `packages/contracts`.
- Deploy the web app as Worker static assets rather than a separate Cloudflare Pages project.
- Deploy `apps/server` to Cloudflare Workers as the API origin for tRPC, sync operations, D1 access, and asset serving.
- Bind D1 to the Worker as the authoritative application database, using a stable binding name such as `DB`.
- Store every successful weather.gov fetch in D1 as an immutable upstream snapshot, with latest-pointer rows for fast repeat reads.
- Run weather.gov sync through the server-side SDK only from the Worker runtime. The browser must continue to call our API, never weather.gov directly.
- Treat cache identity as endpoint plus canonical location plus payload-shaping params. Returning a cached `si` response for a `us` request would be a bug, so these params cannot be ignored.

## Deferred Decisions

- Authentication is out of scope for the initial build.

## References

- Vite: https://vite.dev/guide/
- Tailwind CSS with Vite: https://tailwindcss.com/docs/installation/using-vite
- shadcn/ui with Vite: https://ui.shadcn.com/docs/installation/vite
- TanStack Router file-based routing: https://tanstack.com/router/v1/docs/routing/file-based-routing
- tRPC TanStack React Query setup: https://trpc.io/docs/client/tanstack-react-query/setup
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare Workers React guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare deployment notes: [.docs/cloudflare-deployment.md](/Users/wesley/Development/WindAppForGreg/.docs/cloudflare-deployment.md)
- Upstream API notes: [.docs/weather-gov-api.md](/Users/wesley/Development/WindAppForGreg/.docs/weather-gov-api.md)
- NOAA/NWS GIS map-service notes: [.docs/noaa-gis-map-services.md](/Users/wesley/Development/WindAppForGreg/.docs/noaa-gis-map-services.md)
