# Implementation Plan

Last updated: 2026-04-24

## Goal

Build a Cloudflare-hosted weather.gov API overlay that stores every synced response in D1 as historical data and serves the newest stored snapshot for repeated requests against the same canonical request key.

## Phase 1

Establish the workspace and source-of-truth contracts.

- finalize repo toolchain files
- implement schema-first contracts in `packages/contracts`
- add Cloudflare Wrangler configuration for the Worker, static assets, and D1 binding
- define D1 migrations for the initial snapshot and sync tables
- define canonical request key rules
- define the first tRPC procedure surface

## Phase 2

Implement the Cloudflare Worker overlay foundation.

- add weather.gov adapters
- add point-resolution flow
- add sync orchestration for first-fetch and repeat-read behavior
- persist raw and normalized upstream payloads to D1
- log upstream request IDs and correlation metadata

## Phase 3

Expose the overlay through tRPC.

- mount the one-for-one `/weather/gov/*` proxy route for weather.gov parity and debugging
- compose routers by domain
- return the latest stored snapshot for repeated reads
- expose history procedures for snapshot browsing
- expose structured error responses for upstream and validation failures
- verify Worker runtime compatibility for the tRPC HTTP adapter and weather.gov SDK

## Phase 4

Build the web experience.

- create TanStack Router route tree
- wire tRPC and query client setup
- add location search and current conditions views
- add forecast and hourly forecast views
- add history views for prior snapshots
- configure Cloudflare Vite plugin, Worker static assets, and SPA fallback routing

## Phase 5

Harden the system.

- add contract and integration tests
- add Worker scheduled sync policy if needed
- add observability for sync success, failure, and latency
- add D1 migration and backup/restore runbook
- document operational limits from weather.gov

## First Vertical Slice

The smallest useful slice is:

1. Resolve a point from latitude and longitude.
2. Fetch and store the standard forecast.
3. Return the stored forecast for repeat requests against the same canonical point request.
4. Expose a history endpoint that lists all stored forecast snapshots for that point.
5. Deploy the Worker to Cloudflare with static assets and D1 bound to the same runtime.
