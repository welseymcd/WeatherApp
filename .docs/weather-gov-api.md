# weather.gov API Development Reference

Last verified: 2026-04-23

Primary sources:
- https://www.weather.gov/documentation/services-web-api
- https://api.weather.gov/openapi.json
- NWS/NOAA map-service notes: [.docs/noaa-gis-map-services.md](/Users/wesley/Development/WindAppForGreg/.docs/noaa-gis-map-services.md)

OpenAPI version at verification time: `3.8.1`

## What this service is

The National Weather Service `api.weather.gov` API is a public, read-only HTTP API for forecast data, active alerts, observation stations, latest observations, forecast zones, text products, office briefings, and related metadata.

For application development, the important design choice is that the API is link-driven:

1. Resolve a latitude/longitude with `/points/{lat},{lon}`.
2. Read the URLs returned in `properties` for forecast, hourly forecast, raw grid forecast, stations, and zones.
3. Follow those URLs instead of hard-coding office IDs or grid coordinates.

This is the safest integration path because NWS explicitly notes that grid mappings can change over time.

## Why it is a good fit

- Public and free to use.
- Good coverage for forecast, hourly forecast, alerts, and station observations.
- GeoJSON responses are straightforward to consume in web and mobile apps.
- Response headers expose request IDs that are useful for debugging upstream issues.
- Caching headers are provided and should be honored.

## Main limitations and caveats

- The API is operationally public, but NWS requires a `User-Agent` header identifying the client and a contact method.
- The docs page says limits are generous but unpublished. If exceeded, the restriction usually clears within about 5 seconds.
- `/points/{lat},{lon}` should be treated as a lookup step, not a permanent mapping. Office/grid assignments can change.
- Alert data is not a full historical archive. The docs state active alerts plus roughly 7 days of recently expired alerts are available.
- Observation data may lag by up to about 20 minutes because NWS waits for MADIS quality control.
- Radar endpoints do not provide display-ready radar mosaics/images. They expose metadata and status-style resources, not a full consumer radar product.
- Radar and other weather map overlays should use NOAA/NWS GIS services, not `api.weather.gov`; see [.docs/noaa-gis-map-services.md](/Users/wesley/Development/WindAppForGreg/.docs/noaa-gis-map-services.md).
- The docs note that some forecast quality issues still exist in edge cases, especially around daily min/max values derived from hourly observations.

## Headers, auth, and content negotiation

### Required request header

Use a descriptive `User-Agent` on every request. Recommended format:

```http
User-Agent: (WindAppForGreg, contact@example.com)
```

The OpenAPI spec also advertises an `API-Key` header scheme, but the public guidance still centers on `User-Agent` as the required integration mechanism. Treat API key support as experimental unless NWS publishes stricter guidance later.

### Useful request headers

- `Accept: application/geo+json`
- `Feature-Flags: forecast_temperature_qv,forecast_wind_speed_qv` when testing forecast quantitative-value output
- `Accept-Language` if localization matters

### Response headers worth logging

- `X-Correlation-Id`
- `X-Request-Id`
- `X-Server-Id`

These are exposed by the API and should be captured in application logs for support/debugging.

## Formats and error model

Common response media types:

- `application/geo+json`
- `application/ld+json`
- `application/problem+json` for errors

Error payloads follow RFC 7807 Problem Details. The spec's `ProblemDetail` schema includes:

- `type`
- `title`
- `status`
- `detail`
- `instance`
- `correlationId`

Do not assume only `message` or `error` fields exist.

## Endpoint groups that matter most

### 1. Location resolution

- `GET /points/{latitude},{longitude}`

Use this first. It returns:

- `forecast`
- `forecastHourly`
- `forecastGridData`
- `observationStations`
- `forecastZone`
- `county`

Example from the live API for `39.7456,-97.0892`:

```json
{
  "gridId": "TOP",
  "gridX": 32,
  "gridY": 81,
  "forecast": "https://api.weather.gov/gridpoints/TOP/32,81/forecast",
  "forecastHourly": "https://api.weather.gov/gridpoints/TOP/32,81/forecast/hourly",
  "forecastGridData": "https://api.weather.gov/gridpoints/TOP/32,81",
  "observationStations": "https://api.weather.gov/gridpoints/TOP/32,81/stations",
  "forecastZone": "https://api.weather.gov/zones/forecast/KSZ009"
}
```

### 2. Forecasts

- `GET /gridpoints/{wfo}/{x},{y}/forecast`
- `GET /gridpoints/{wfo}/{x},{y}/forecast/hourly`
- `GET /gridpoints/{wfo}/{x},{y}`

Recommended usage:

- Use `/forecast` for standard user-facing daypart forecasts.
- Use `/forecast/hourly` for short-horizon hourly views.
- Use `/gridpoints/{wfo}/{x},{y}` when you need raw quantitative forecast layers.

Observed live forecast sample on 2026-04-23:

```json
{
  "name": "This Afternoon",
  "temperature": 80,
  "temperatureUnit": "F",
  "probabilityOfPrecipitation": {
    "unitCode": "wmoUnit:percent",
    "value": 53
  },
  "windSpeed": "10 to 15 mph",
  "windDirection": "W",
  "shortForecast": "Chance Showers And Thunderstorms"
}
```

Useful query/header options:

- `units=us` or `units=si` on textual forecast endpoints
- `Feature-Flags: forecast_temperature_qv,forecast_wind_speed_qv` if you want quantitative-value forecast fields while experimenting

### 3. Stations and observations

- `GET /gridpoints/{wfo}/{x},{y}/stations`
- `GET /stations`
- `GET /stations/{stationId}`
- `GET /stations/{stationId}/observations/latest`
- `GET /stations/{stationId}/observations`

For current conditions:

1. Start from `/points`.
2. Follow `observationStations`.
3. Pick a station.
4. Fetch `/stations/{stationId}/observations/latest`.

The latest observation endpoint accepts `require_qc=true` if only quality-controlled readings should be returned.

Observed live sample:

```json
{
  "timestamp": "2026-04-23T18:15:00+00:00",
  "textDescription": "Cloudy",
  "temperature": {
    "unitCode": "wmoUnit:degC",
    "value": 25
  },
  "windSpeed": {
    "unitCode": "wmoUnit:km_h-1",
    "value": 22.32
  },
  "windDirection": {
    "unitCode": "wmoUnit:degree_(angle)",
    "value": 200
  },
  "relativeHumidity": {
    "unitCode": "wmoUnit:percent",
    "value": 53.830642264244
  }
}
```

Observation values use structured quantitative objects, not simple scalar fields. Build parsers accordingly.

### 4. Alerts

- `GET /alerts`
- `GET /alerts/active`
- `GET /alerts/active/area/{area}`
- `GET /alerts/active/zone/{zoneId}`
- `GET /alerts/active/region/{region}`
- `GET /alerts/active/count`
- `GET /alerts/types`
- `GET /alerts/{id}`

For app use:

- Use `/alerts/active?area=ST` or `/alerts/active/area/{area}` for state-level alert views.
- Use `/alerts/active/zone/{zoneId}` when you already have a zone from `/points`.
- Use `/alerts/active/count` for dashboards or light-weight health widgets.

Important query options on `/alerts` include:

- `start`
- `end`
- `status`
- `message_type`
- `event`
- `code`
- `area`
- `point`
- `region`
- `region_type`
- `zone`
- `urgency`
- `severity`
- `certainty`
- `limit`
- `cursor`

Observed live sample for `GET /alerts/active?area=KS` on 2026-04-23:

```json
{
  "event": "Special Weather Statement",
  "severity": "Moderate",
  "certainty": "Observed",
  "urgency": "Expected",
  "effective": "2026-04-23T13:46:00-05:00",
  "expires": "2026-04-23T14:15:00-05:00",
  "areaDesc": "Republic; Washington"
}
```

### 5. Zones

- `GET /zones/{type}/{zoneId}`
- `GET /zones/{type}/{zoneId}/forecast`
- `GET /zones/forecast/{zoneId}/observations`
- `GET /zones/forecast/{zoneId}/stations`

Zone endpoints are useful when your UI is organized by forecast zone instead of by gridpoint or station.

### 6. Text products and office resources

- `GET /products`
- `GET /products/types`
- `GET /products/types/{typeId}/locations/{locationId}/latest`
- `GET /offices/{officeId}`
- `GET /offices/{officeId}/headlines`
- `GET /offices/{officeId}/briefing`

These are useful for advanced or internal tooling, but they are usually secondary to forecast, observation, and alert integration in a consumer weather app.

## Pagination

Pagination is cursor-based on endpoints that support it.

- Query parameter: `cursor`
- Typical companion parameter: `limit`
- Spec maximum for `limit`: `500`

Do not build page-number pagination assumptions.

## Caching behavior

Honor upstream caching headers rather than using one fixed TTL for every endpoint.

Observed response headers on 2026-04-23:

- `/points/39.7456,-97.0892`: `Cache-Control: public, max-age=29966, s-maxage=120`
- `/gridpoints/TOP/32,81/forecast`: `Cache-Control: public, max-age=3595, s-maxage=3600`

Also note the API returned:

```http
Vary: Accept,Feature-Flags,Accept-Language
```

Implications:

- Cache keys should include the request URL plus any headers that alter representation.
- `/points` can usually be cached much longer than forecasts.
- Forecast data should be refreshed more aggressively.
- If you build a server-side cache, persist upstream `Expires` or parsed `max-age` per resource.

## Recommended integration flow for this project

### Forecast flow

1. Input a latitude/longitude.
2. Fetch `/points/{lat},{lon}`.
3. Cache the linked forecast URLs from the response.
4. Fetch `forecast` for primary display.
5. Fetch `forecastHourly` only where the UI needs hourly detail.
6. Use `forecastGridData` only for advanced numeric features.

### Current conditions flow

1. Resolve `/points`.
2. Follow `observationStations`.
3. Choose the nearest or first station returned.
4. Fetch `/observations/latest`.
5. Convert quantitative values into app display units.

### Alerts flow

1. Resolve `/points`.
2. Read `forecastZone` from the point response.
3. Fetch active alerts by zone for precise relevance.
4. Optionally fetch by state as a fallback or broader context view.

## Recommended client design

- Centralize all NWS calls in one client module.
- Always attach `User-Agent`.
- Default `Accept` to `application/geo+json`.
- Parse and log `X-Correlation-Id` and `X-Request-Id`.
- Respect per-endpoint cache headers.
- Add retry-with-backoff for transient `5xx` failures.
- Parse RFC 7807 error bodies before surfacing errors to the UI.
- Store coordinate-to-point lookups separately from forecast payload caches.
- Keep unit conversion in the app layer because the API mixes textual values and quantitative objects depending on endpoint.

## Minimal TypeScript fetch wrapper

```ts
const NWS_BASE_URL = "https://api.weather.gov";
const NWS_USER_AGENT =
  process.env.NWS_USER_AGENT ?? "(WindAppForGreg, contact@example.com)";

type NwsProblem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId?: string;
};

export async function fetchNwsJson<T>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${NWS_BASE_URL}${pathOrUrl}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": NWS_USER_AGENT,
    },
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as NwsProblem | null;
    const detail = problem?.detail ?? `NWS request failed with ${response.status}`;
    throw new Error(detail);
  }

  return (await response.json()) as T;
}
```

## Suggested first endpoints to wrap in code

- `/points/{lat},{lon}`
- linked `forecast`
- linked `forecastHourly`
- linked `observationStations`
- `/stations/{stationId}/observations/latest`
- `/alerts/active/zone/{zoneId}`

That set covers the core weather-app use case without overbuilding against lower-value endpoint families.

## Service summary

This API is strong for location-based forecast, current conditions, and active alert workflows. The safest implementation pattern is to treat `/points` as the authoritative entrypoint, follow returned URLs, honor cache headers, and normalize mixed response shapes at the client boundary.
