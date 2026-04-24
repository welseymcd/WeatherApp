# Cloudflare Deployment

Last updated: 2026-04-24

## Worker

- Worker name: `wind-app-for-greg`
- Worker config: `apps/server/wrangler.toml`
- Production route: `weather.rmcd.cc/*`
- Production API base URL: `https://weather.rmcd.cc`
- Zone route mode is used because `weather.rmcd.cc` already exists as a proxied hostname in the `rmcd.cc` zone.
- Runtime: Cloudflare Workers
- Local runtime: Wrangler dev against the Worker config

## D1

- Binding name: `DB`
- Database name: `wind-app-for-greg`
- Database ID: `3d807f73-0109-47e2-9bb1-af3acd59db82`
- Initial migration: `apps/server/migrations/0001_init_weather_overlay.sql`
- Remote migrations have been applied to the production D1 database.
- Local migrations can be applied to Wrangler's local D1 state for development.

## Email Service

- Binding name: `EMAIL`
- Sender address: `weather@rmcd.cc`
- Sender allowlist: `weather@rmcd.cc`
- Required secret: `EMAIL_API_KEY`
- Send endpoint: `POST https://weather.rmcd.cc/api/email/send`

The email endpoint uses Cloudflare Email Service through the Worker `send_email` binding. Callers cannot provide a `from` address; the Worker always sends from `EMAIL_FROM` to avoid exposing an open relay.

Set the production API key secret before deploying or using the endpoint:

```sh
wrangler secret put EMAIL_API_KEY --config apps/server/wrangler.toml
```

Request shape:

```json
{
  "to": "recipient@example.com",
  "subject": "Weather update",
  "text": "Clear skies.",
  "html": "<p>Clear skies.</p>",
  "replyTo": "support@rmcd.cc"
}
```

## Public Routes

- Raw weather.gov-compatible proxy: `https://weather.rmcd.cc/weather/gov/*`
- tRPC endpoint: `https://weather.rmcd.cc/trpc/*`
- Email sending endpoint: `https://weather.rmcd.cc/api/email/send`
- Example raw endpoint: `https://weather.rmcd.cc/weather/gov/points/39.7456,-97.0892`
- Example tRPC endpoint: `https://weather.rmcd.cc/trpc/weatherGov.resolvePoint?input=%7B%22latitude%22%3A39.7456%2C%22longitude%22%3A-97.0892%7D`

## Commands

```sh
bun run dev
bun run build
```

`bun run dev` starts the local Cloudflare Worker runtime with D1 bindings from `apps/server/wrangler.toml`.

`bun run build` bundles the Worker into `dist/worker` using Wrangler's deploy pipeline in dry-run mode. It validates the production bundle without publishing a deployment.

Cloudflare-specific commands remain available when a narrower operation is needed:

```sh
bun run cf:dev
bun run cf:deploy
bun run cf:types
bun run d1:migrations:apply:local
bun run d1:migrations:apply
```

## Live Smoke Checks

```sh
curl https://weather.rmcd.cc/weather/gov/points/39.7456,-97.0892
curl 'https://weather.rmcd.cc/trpc/weatherGov.resolvePoint?input=%7B%22latitude%22%3A39.7456%2C%22longitude%22%3A-97.0892%7D'
```
