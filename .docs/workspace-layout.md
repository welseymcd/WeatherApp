# Workspace Layout

Last updated: 2026-04-24

## Root Structure

```text
WindAppForGreg/
  .docs/
    architecture.md
    implementation-plan.md
    tech_stack.md
    weather-gov-api.md
    workspace-layout.md
  apps/
    server/
      wrangler.toml
      src/
        adapters/weather-gov/
        bootstrap/
        config/
        domain/
          locations/
          requests/
          snapshots/
        jobs/
        lib/
          http/
          observability/
        persistence/
          d1/
          migrations/
          repositories/
        routers/
        services/
          overlay/
          sync/
      test/
        contract/
        integration/
    web/
      public/
      src/
        app/
        components/
          layout/
          ui/
        features/
          history/
          locations/
          weather/
        hooks/
        lib/
          router/
          trpc/
          utils/
        routes/
        styles/
  packages/
    client-runtime/
      src/
        adapters/
        formatting/
        location/
        query/
    contracts/
      specs/
      src/
        base/
        errors/
        history/
        overlay/
        transport/
        weather/
      test/
    effect-acp/
      src/
    shared/
      src/
        constants/
        env/
        formatting/
        time/
```

## Ownership Rules

- `apps/server` owns all weather.gov access, sync logic, cache policy, D1 persistence, and the Cloudflare Worker runtime.
- `apps/web` owns the user-facing React/Vite experience, is deployed as Worker static assets, and should depend on the overlay only through contracts and client-runtime helpers.
- `packages/contracts` stays near the bottom of the dependency graph and should remain schema-only.
- `packages/shared` may depend on `packages/contracts`, but not on app packages.
- `packages/client-runtime` may depend on `packages/contracts` and `packages/shared`, but not on server implementation code.

## App Notes

- Keep shadcn components local to `apps/web` because there is only one browser client today.
- Keep TanStack Router route files in `apps/web/src/routes`.
- Keep tRPC router composition in `apps/server/src/routers`.
- Keep upstream-specific mapping logic inside `apps/server/src/adapters/weather-gov`.
- Keep historical read models and sync persistence concerns in `apps/server/src/persistence`.
- Keep Cloudflare D1 migrations and D1-specific SQL helpers in `apps/server/src/persistence/d1` or `apps/server/src/persistence/migrations`.
- Keep Wrangler configuration with the Cloudflare-deployed app it configures.

## Empty Packages

`packages/effect-acp` is scaffolded but intentionally unused for now. It stays available if protocol or runtime concerns later justify a dedicated package.
