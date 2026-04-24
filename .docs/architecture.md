# Architecture

Last updated: 2026-04-24

## Product Model

WindAppForGreg is a Cloudflare Worker-hosted API overlay in front of `api.weather.gov`, not a direct browser-to-upstream client. The Worker owns request normalization, upstream sync, D1 persistence, static asset hosting, and history. The React web app is deployed as Worker static assets and talks only to our API routes.

## Core Behavior

1. The Worker-hosted React client calls a tRPC procedure exposed by the same Cloudflare Worker deployment.
2. The Worker canonicalizes the request into a deterministic `requestKey`.
3. The `requestKey` is built from:
   - endpoint kind
   - canonical location
   - any response-shaping parameters that change the payload, such as `units` or language
4. If a stored snapshot already exists for that `requestKey`, the overlay returns the newest stored snapshot.
5. If no snapshot exists yet, the Worker fetches the upstream resource through the weather.gov SDK, stores it in D1, and returns the first stored snapshot.
6. Every successful upstream sync appends a new D1 historical snapshot instead of overwriting previous data.

This preserves the user requirement that repeated requests for the same endpoint and location return the previously stored data while still allowing the system to keep syncing upstream data over time.

## API Surfaces

- `/trpc/*` is the app-facing overlay API. It returns normalized, D1-backed data and history semantics.
- `/weather/gov/*` is a one-for-one weather.gov proxy surface. A request such as `/weather/gov/points/{lat},{lon}` maps to `https://api.weather.gov/points/{lat},{lon}` through the server-side SDK.
- The `/weather/gov/*` surface should preserve the caller's path and query string, attach the required weather.gov `User-Agent`, and return upstream JSON/problem payloads with upstream request metadata exposed on response headers.
- The `/weather/gov/*` surface is useful for parity, debugging, and internal tooling. Product UI should prefer `/trpc/*` once normalized D1-backed procedures exist.

## Initial Domain Scope

The first implementation should support the weather.gov resources that matter most for a forecast workflow:

- point resolution
- standard forecast
- hourly forecast
- observation stations
- latest observation
- active alerts by zone or state

These map cleanly onto the link-driven weather.gov flow already documented in [.docs/weather-gov-api.md](/Users/wesley/Development/WindAppForGreg/.docs/weather-gov-api.md).

## System Boundaries

- `apps/web`: React/Vite route-driven UI, user input, visualization, client navigation, and local presentation state, built into Worker static assets
- `apps/server`: Cloudflare Worker-hosted overlay procedures, upstream adapters, sync orchestration, D1 persistence, static asset routing, and observability
- `packages/contracts`: shared transport-safe request, response, error, and history shapes
- `packages/shared`: runtime-neutral utilities shared by multiple packages
- `packages/client-runtime`: browser-safe helpers for query setup, serialization, and client formatting
- `packages/effect-acp`: reserved for future protocol/runtime concerns and not part of v1 scope

## Data Model Concepts

The D1 data model should center around five persistent concepts:

- `locations`: normalized location identities such as point coordinates and derived zone/station references
- `overlay_request_keys`: canonical request identities for endpoint plus location plus payload-shaping params
- `upstream_snapshots`: immutable raw and normalized records of each upstream fetch
- `latest_snapshot_pointers`: optional read optimization for the newest snapshot per request key
- `sync_runs`: audit records for fetch attempts, durations, headers, and failure details

## Cloudflare Runtime Model

- Cloudflare Workers serves the API overlay, owns all weather.gov traffic, and serves the built React/Vite static assets.
- Cloudflare D1 is bound to the Worker and stores request keys, raw upstream payloads, normalized payloads, latest pointers, and sync audit records.
- The Cloudflare Vite plugin should run local development against the Worker runtime where possible.
- Wrangler owns D1 migrations, generated Cloudflare runtime types, and deployments.
- Scheduled sync, if added, should run as a Worker scheduled event that uses the same SDK and persistence services as on-demand requests.

## Design Rules

- The browser never calls weather.gov directly.
- The browser never reads or writes D1 directly.
- D1 writes happen only inside Worker-side sync or persistence code.
- Cache identity must be deterministic and collision-safe.
- The newest stored snapshot is the read model for repeated requests.
- Historical snapshots are append-only and queryable.
- Raw upstream payloads should be stored alongside normalized payloads for debugging and replay.
- Upstream problem payloads should be preserved as structured records when sync attempts fail.

## Risks To Account For

- weather.gov is link-driven, so `/points` resolution cannot be treated as permanent
- alert history is limited upstream and should not be mistaken for a full archive
- station observations can lag behind real time
- parameter variants such as `units=us` and `units=si` must not share the same request key
