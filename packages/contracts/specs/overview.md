# Contract Overview

Last updated: 2026-04-23

## Purpose

The overlay needs one shared contract layer for three concerns:

- web-to-server transport
- normalized weather domain data
- persisted history and sync audit records
- runtime API input validation

These contracts should be authored once in `packages/contracts` and then consumed by both the web app and the server. Zod is the runtime schema layer for API inputs and transport-safe inferred TypeScript types.

## Contract Groups

- `base`: IDs, timestamps, coordinates, units, pagination, and canonical key primitives
- `weather`: normalized forecast, observation, station, zone, and alert shapes
- `overlay`: app-facing query inputs and outputs
- `history`: snapshot summaries, stored payload references, and sync records
- `errors`: validation, upstream, and not-found error shapes
- `transport`: shared response envelopes and cursor pagination

## Schema Runtime

- Zod schemas live under `packages/contracts/src`.
- tRPC procedure inputs should use exported Zod schemas directly.
- App and server code should infer TypeScript types from those schemas instead of duplicating input types.
- Contracts must remain transport-safe and must not import app or server implementation code.

## Canonical Request Identity

Every stored snapshot belongs to a deterministic `requestKey`. The request key must include:

- endpoint kind
- canonical location identity
- payload-shaping params such as units or locale

The request key must not include transient metadata such as request time, caller identity, or correlation headers.

## Normalization Rules

- Keep one normalized representation for each supported weather.gov resource.
- Store raw upstream payloads separately for audit and replay.
- Preserve upstream timestamps and request identifiers when present.
- Keep public contracts stable even if upstream payload details evolve.

## Planned v1 Domains

- point lookup
- daily forecast
- hourly forecast
- latest observation
- active alerts
- snapshot history
