-- Migration number: 0001 	 2026-04-24T03:43:00.391Z
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  station_id TEXT,
  forecast_zone_id TEXT,
  grid_id TEXT,
  grid_x INTEGER,
  grid_y INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_locations_point
  ON locations(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_station_id
  ON locations(station_id)
  WHERE station_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_forecast_zone_id
  ON locations(forecast_zone_id)
  WHERE forecast_zone_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS overlay_request_keys (
  request_key TEXT PRIMARY KEY,
  endpoint_kind TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  canonical_location_json TEXT,
  params_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_overlay_request_keys_endpoint
  ON overlay_request_keys(endpoint_kind);

CREATE INDEX IF NOT EXISTS idx_overlay_request_keys_location
  ON overlay_request_keys(location_id);

CREATE TABLE IF NOT EXISTS upstream_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL REFERENCES overlay_request_keys(request_key) ON DELETE CASCADE,
  upstream_source_url TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  source_fetched_at TEXT NOT NULL,
  cache_expires_at TEXT,
  response_headers_json TEXT,
  raw_payload_json TEXT NOT NULL,
  normalized_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_upstream_snapshots_request_key_created
  ON upstream_snapshots(request_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upstream_snapshots_source_fetched
  ON upstream_snapshots(source_fetched_at DESC);

CREATE TABLE IF NOT EXISTS latest_snapshot_pointers (
  request_key TEXT PRIMARY KEY REFERENCES overlay_request_keys(request_key) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES upstream_snapshots(snapshot_id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  sync_run_id TEXT PRIMARY KEY,
  request_key TEXT REFERENCES overlay_request_keys(request_key) ON DELETE SET NULL,
  endpoint_kind TEXT NOT NULL,
  upstream_source_url TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  response_headers_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_request_key_started
  ON sync_runs(request_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_runs_status_started
  ON sync_runs(status, started_at DESC);
