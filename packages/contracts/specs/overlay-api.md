# Overlay API Contracts

Last updated: 2026-04-23

## Shared Input Concepts

- `PointLocationInput`
  - `latitude`
  - `longitude`
- `PresentationOptions`
  - `units`
  - `language`

The canonical request key for v1 should be derived from the endpoint name, normalized point coordinates, and presentation options.

All tRPC procedure inputs should be validated with Zod schemas exported from `packages/contracts/src`.

## Shared Response Envelope

Every read procedure should return an envelope with:

- `requestKey`
- `snapshotId`
- `servedAt`
- `sourceFetchedAt`
- `servedFromHistory`
- `upstreamSourceUrl`
- `data`

`servedFromHistory` should be `true` whenever the overlay is returning a previously stored snapshot rather than a direct pass-through response.

## Planned Procedures

### `weatherGov.*`

The `weatherGov` tRPC namespace wraps every weather.gov SDK endpoint with Zod-validated inputs. These procedures return upstream-shaped payload envelopes and are useful for typed API access, debugging, and internal tooling. Product UI should prefer normalized overlay procedures once D1-backed read models exist.

Initial procedures:

- `weatherGov.resolvePoint`
- `weatherGov.getForecast`
- `weatherGov.getHourlyForecast`
- `weatherGov.getGridpoint`
- `weatherGov.getObservationStations`
- `weatherGov.getStations`
- `weatherGov.getStation`
- `weatherGov.getLatestObservation`
- `weatherGov.getActiveAlerts`
- `weatherGov.getActiveAlertsByArea`
- `weatherGov.getActiveAlertsByZone`
- `weatherGov.getActiveAlertCount`
- `weatherGov.getForecastForPoint`
- `weatherGov.getHourlyForecastForPoint`
- `weatherGov.getObservationStationsForPoint`
- `weatherGov.getLatestObservationForPoint`
- `weatherGov.getActiveAlertsForPoint`

### `location.resolvePoint`

Input:

- `latitude`
- `longitude`

Output `data`:

- normalized point identity
- grid metadata
- forecast URL reference
- forecast hourly URL reference
- observation stations URL reference
- forecast zone reference

### `forecast.getByPoint`

Input:

- `latitude`
- `longitude`
- optional `units`

Output `data`:

- normalized forecast periods
- attribution and update timestamps
- derived location summary

### `forecast.getHourlyByPoint`

Input:

- `latitude`
- `longitude`
- optional `units`

Output `data`:

- normalized hourly forecast periods
- attribution and update timestamps
- derived location summary

### `observations.getLatestByPoint`

Input:

- `latitude`
- `longitude`

Output `data`:

- chosen station summary
- latest observation timestamp
- normalized temperature, wind, humidity, and text description

### `alerts.getActiveByPoint`

Input:

- `latitude`
- `longitude`

Output `data`:

- derived forecast zone
- active alerts list
- count summary

### `history.listSnapshots`

Input:

- `requestKey`
- optional cursor or limit

Output `data`:

- ordered snapshot summaries for that request key
- pagination info

### `history.getSnapshot`

Input:

- `snapshotId`

Output `data`:

- full normalized payload
- raw payload reference or embedded raw JSON, depending on storage choice
- sync metadata

## Error Shapes

The public API should expose structured errors for:

- invalid location input
- unsupported endpoint or params
- upstream fetch failure
- upstream problem detail response
- requested snapshot not found
