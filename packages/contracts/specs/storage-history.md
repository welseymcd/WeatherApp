# Storage And History Contracts

Last updated: 2026-04-23

## Persistent Records

### `LocationRef`

Represents a normalized location identity used across the system.

Fields:

- `locationId`
- `kind`
- `latitude`
- `longitude`
- optional `gridId`
- optional `gridX`
- optional `gridY`
- optional `forecastZoneId`

### `CanonicalRequestKey`

Represents the stable read identity for cached overlay responses.

Fields:

- `requestKey`
- `endpointKind`
- `locationId`
- `paramsHash`
- `canonicalParams`

### `UpstreamSnapshot`

Represents one immutable stored result from an upstream sync.

Fields:

- `snapshotId`
- `requestKey`
- `status`
- `fetchedAt`
- optional `upstreamUpdatedAt`
- `upstreamUrl`
- optional `upstreamETag`
- optional `cacheControl`
- optional `correlationId`
- optional `requestId`
- `normalizedPayload`
- `rawPayload`

### `LatestSnapshotPointer`

Optional optimization record for fast reads.

Fields:

- `requestKey`
- `snapshotId`
- `updatedAt`

### `SyncRun`

Represents one sync attempt, whether it succeeds or fails.

Fields:

- `syncRunId`
- `requestKey`
- `startedAt`
- `finishedAt`
- `trigger`
- `outcome`
- optional `errorSummary`

## Invariants

- snapshots are append-only
- a new successful sync creates a new snapshot record
- repeat reads never mutate historical records
- the latest pointer, if used, is derived data and can be rebuilt from snapshots
- raw payloads are stored exactly as returned by the upstream source

## Read Model Rule

For a repeated request against the same canonical request key, the overlay should read the newest stored snapshot and return that payload. This is the core rule that separates the overlay from a simple proxy.

## History Query Rule

History APIs should expose snapshots newest-first by default while preserving stable snapshot IDs for direct lookup and audit trails.
