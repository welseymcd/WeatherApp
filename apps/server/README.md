# apps/server

This app will own the Cloudflare Worker API overlay, upstream sync behavior, D1 persistence, and operational logging.

## Deployment

- Production domain: `https://weather.rmcd.cc`
- Worker name: `wind-app-for-greg`
- Worker route: `weather.rmcd.cc/*`
- D1 binding: `DB`
- D1 database: `wind-app-for-greg`
- Email binding: `EMAIL`
- Email sender: `weather@rmcd.cc`

## Scripts

```sh
bun run dev
bun run build
bun run cf:deploy
```

`bun run dev` starts the Worker locally with Wrangler.

`bun run build` bundles the Worker into `dist/worker` using Wrangler's dry-run deploy pipeline.

`bun run cf:deploy` deploys the Worker to Cloudflare.

## Email Endpoint

`POST /api/email/send` sends transactional email through Cloudflare Email Service.

The endpoint requires `Authorization: Bearer <EMAIL_API_KEY>` and accepts JSON:

```json
{
  "to": "recipient@example.com",
  "subject": "Weather update",
  "text": "Clear skies.",
  "html": "<p>Clear skies.</p>",
  "replyTo": "support@rmcd.cc"
}
```

Set `EMAIL_API_KEY` as a Wrangler secret before using the endpoint in production.

Planned subdirectories:

- `src/routers`: tRPC router composition and procedure entrypoints
- `src/services/overlay`: read behavior for latest stored snapshots
- `src/services/sync`: upstream fetch and persistence workflows
- `src/adapters/weather-gov`: weather.gov request and mapping logic
- `src/persistence`: repositories and migrations
- `src/persistence/d1`: Cloudflare D1 SQL helpers and database-specific adapters
- `src/domain`: location, request-key, and snapshot domain models
- `src/lib`: HTTP and observability helpers
- `src/jobs`: optional scheduled or queued sync work
- `test/contract`: boundary tests against shared contracts
- `test/integration`: end-to-end overlay behavior tests
