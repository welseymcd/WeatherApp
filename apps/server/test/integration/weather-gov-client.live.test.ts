import { beforeAll, describe, expect, test } from "vitest";

import { WeatherGovClient } from "../../src/adapters/weather-gov/index.ts";
import { handleWeatherGovProxyRequest } from "../../src/routes/weather-gov-proxy.ts";

const TEST_LATITUDE = 39.7456;
const TEST_LONGITUDE = -97.0892;
const TEST_AREA = "KS";
const TEST_USER_AGENT =
  process.env.NWS_USER_AGENT ??
  "(WindAppForGreg integration tests, contact@example.com)";

const client = new WeatherGovClient({
  userAgent: TEST_USER_AGENT,
  maxRetries: 1,
  retryBaseDelayMs: 500,
});

let pointResponse: Awaited<ReturnType<typeof client.resolvePoint>>;
let stationId: string;
let zoneId: string;

describe("WeatherGovClient live integration", () => {
  beforeAll(async () => {
    pointResponse = await client.resolvePoint(TEST_LATITUDE, TEST_LONGITUDE);
    stationId = await resolveFirstStationId();
    zoneId = extractLastPathSegment(pointResponse.data.properties.forecastZone);
  }, 30_000);

  test(
    "weather.gov proxy route mirrors a live point request",
    async () => {
      const response = await handleWeatherGovProxyRequest(
        new Request(
          `https://example.test/weather/gov/points/${TEST_LATITUDE},${TEST_LONGITUDE}`,
        ),
        {
          NWS_USER_AGENT: TEST_USER_AGENT,
        },
      );

      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);
      expect(response?.headers.get("Content-Type")).toContain("application/geo+json");
      await expect(response?.json()).resolves.toMatchObject({
        type: "Feature",
        properties: {
          gridId: expect.any(String),
        },
      });
    },
    30_000,
  );

  test(
    "resolvePoint returns the linked resources for a known coordinate",
    async () => {
      const response = await client.resolvePoint(TEST_LATITUDE, TEST_LONGITUDE);

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.gridId).toBeTruthy();
      expect(response.data.properties.forecast).toMatch(/^https:\/\/api\.weather\.gov\//);
      expect(response.data.properties.forecastHourly).toMatch(
        /^https:\/\/api\.weather\.gov\//,
      );
      expect(response.data.properties.forecastGridData).toMatch(
        /^https:\/\/api\.weather\.gov\//,
      );
      expect(response.data.properties.observationStations).toMatch(
        /^https:\/\/api\.weather\.gov\//,
      );
      expect(response.data.properties.forecastZone).toMatch(
        /^https:\/\/api\.weather\.gov\//,
      );
      expect(response.meta.status).toBe(200);
      expect(response.meta.ok).toBe(true);
    },
    30_000,
  );

  test(
    "getForecast calls the linked forecast endpoint",
    async () => {
      const forecastUrl = pointResponse.data.properties.forecast;
      expect(forecastUrl).toBeTruthy();

      const response = await client.getForecast(forecastUrl!, { units: "us" });

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.periods.length).toBeGreaterThan(0);
      expect(response.meta.url).toContain("units=us");
    },
    30_000,
  );

  test(
    "getHourlyForecast calls the linked hourly forecast endpoint",
    async () => {
      const forecastUrl = pointResponse.data.properties.forecastHourly;
      expect(forecastUrl).toBeTruthy();

      const response = await client.getHourlyForecast(forecastUrl!, { units: "us" });

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.periods.length).toBeGreaterThan(0);
      expect(response.meta.url).toContain("units=us");
    },
    30_000,
  );

  test(
    "getGridpoint calls the linked raw gridpoint endpoint",
    async () => {
      const gridpointUrl = pointResponse.data.properties.forecastGridData;
      expect(gridpointUrl).toBeTruthy();

      const response = await client.getGridpoint(gridpointUrl!);

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.updateTime).toBeTruthy();
    },
    30_000,
  );

  test(
    "getObservationStations calls the linked stations endpoint",
    async () => {
      const stationsUrl = pointResponse.data.properties.observationStations;
      expect(stationsUrl).toBeTruthy();

      const response = await client.getObservationStations(stationsUrl!);

      expect(response.data.type).toBe("FeatureCollection");
      expect(response.data.features.length).toBeGreaterThan(0);
      expect(response.data.features[0]?.properties.stationIdentifier).toBeTruthy();
    },
    30_000,
  );

  test(
    "getStations returns the top-level station collection",
    async () => {
      const response = await client.getStations({
        ids: [stationId],
        states: [TEST_AREA],
        limit: 5,
      });

      expect(response.data.type).toBe("FeatureCollection");
      expect(response.data.features.length).toBeGreaterThan(0);
      expect(response.meta.url).toContain("/stations?");
      expect(response.meta.url).toContain(`id=${stationId}`);
      expect(response.meta.url).toContain("state=KS");
    },
    30_000,
  );

  test(
    "getStation returns the selected station payload",
    async () => {
      const response = await client.getStation(stationId);

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.stationIdentifier).toBe(stationId);
      expect(response.data.properties.name).toBeTruthy();
    },
    30_000,
  );

  test(
    "getLatestObservation returns the latest observation payload",
    async () => {
      const response = await client.getLatestObservation(stationId);

      expect(response.data.type).toBe("Feature");
      expect(response.data.properties.timestamp).toBeTruthy();
      expect(response.data.properties.textDescription).toBeTypeOf("string");
    },
    30_000,
  );

  test(
    "getActiveAlerts queries the generic alerts endpoint",
    async () => {
      const response = await client.getActiveAlerts({
        area: TEST_AREA,
        limit: 5,
      });

      expect(response.data.type).toBe("FeatureCollection");
      expect(Array.isArray(response.data.features)).toBe(true);
      expect(response.meta.url).toContain("/alerts?");
      expect(response.meta.url).toContain("area=KS");
    },
    30_000,
  );

  test(
    "getActiveAlertsByArea queries the state-level active alerts endpoint",
    async () => {
      const response = await client.getActiveAlertsByArea(TEST_AREA);

      expect(response.data.type).toBe("FeatureCollection");
      expect(Array.isArray(response.data.features)).toBe(true);
      expect(response.meta.url).toContain("/alerts/active/area/KS");
    },
    30_000,
  );

  test(
    "getActiveAlertsByZone queries the zone-level active alerts endpoint",
    async () => {
      const response = await client.getActiveAlertsByZone(zoneId);

      expect(response.data.type).toBe("FeatureCollection");
      expect(Array.isArray(response.data.features)).toBe(true);
      expect(response.meta.url).toContain(`/alerts/active/zone/${zoneId}`);
    },
    30_000,
  );

  test(
    "getActiveAlertCount returns the active count summary",
    async () => {
      const response = await client.getActiveAlertCount();

      expect(response.meta.status).toBe(200);
      expect(response.data).toBeTruthy();
      expect(typeof response.data).toBe("object");
    },
    30_000,
  );

  test(
    "getForecastForPoint follows the point-to-forecast flow",
    async () => {
      const response = await client.getForecastForPoint(TEST_LATITUDE, TEST_LONGITUDE, {
        units: "us",
      });

      expect(response.point.data.properties.forecast).toBeTruthy();
      expect(response.response.data.properties.periods.length).toBeGreaterThan(0);
    },
    30_000,
  );

  test(
    "getHourlyForecastForPoint follows the point-to-hourly-forecast flow",
    async () => {
      const response = await client.getHourlyForecastForPoint(
        TEST_LATITUDE,
        TEST_LONGITUDE,
        { units: "us" },
      );

      expect(response.point.data.properties.forecastHourly).toBeTruthy();
      expect(response.response.data.properties.periods.length).toBeGreaterThan(0);
    },
    30_000,
  );

  test(
    "getObservationStationsForPoint follows the point-to-stations flow",
    async () => {
      const response = await client.getObservationStationsForPoint(
        TEST_LATITUDE,
        TEST_LONGITUDE,
      );

      expect(response.point.data.properties.observationStations).toBeTruthy();
      expect(response.response.data.features.length).toBeGreaterThan(0);
    },
    30_000,
  );

  test(
    "getLatestObservationForPoint follows the point-to-observation flow",
    async () => {
      const response = await client.getLatestObservationForPoint(
        TEST_LATITUDE,
        TEST_LONGITUDE,
      );

      expect(response.station.properties.stationIdentifier).toBeTruthy();
      expect(response.observation.data.properties.timestamp).toBeTruthy();
    },
    30_000,
  );

  test(
    "getActiveAlertsForPoint follows the point-to-zone-alerts flow",
    async () => {
      const response = await client.getActiveAlertsForPoint(
        TEST_LATITUDE,
        TEST_LONGITUDE,
      );

      expect(response.point.data.properties.forecastZone).toBeTruthy();
      expect(Array.isArray(response.response.data.features)).toBe(true);
    },
    30_000,
  );
});

async function resolveFirstStationId(): Promise<string> {
  const stationsUrl = pointResponse.data.properties.observationStations;
  expect(stationsUrl).toBeTruthy();

  const stationsResponse = await client.getObservationStations(stationsUrl!);
  const firstStation = stationsResponse.data.features[0];

  expect(firstStation).toBeTruthy();

  const stationIdentifier = firstStation?.properties.stationIdentifier;
  if (!stationIdentifier) {
    throw new Error("weather.gov did not return a station identifier for the first station.");
  }

  return stationIdentifier;
}

function extractLastPathSegment(value: string | undefined): string {
  if (!value) {
    throw new Error("weather.gov did not return the expected linked URL.");
  }

  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1);

  if (!lastSegment) {
    throw new Error(`Could not extract a path segment from ${value}.`);
  }

  return lastSegment;
}
