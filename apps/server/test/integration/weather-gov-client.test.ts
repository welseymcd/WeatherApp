import { describe, expect, test } from "vitest";

import {
  WeatherGovClient,
  WeatherGovRequestError,
} from "../../src/adapters/weather-gov/index.ts";

describe("WeatherGovClient", () => {
  test("resolvePoint sends required headers and captures response metadata", async () => {
    const seenRequests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];

    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      acceptLanguage: "en-US",
      featureFlags: ["forecast_temperature_qv"],
      fetch: async (input, init) => {
        seenRequests.push({ input, init });

        return new Response(
          JSON.stringify({
            type: "Feature",
            properties: {
              forecast: "https://api.weather.gov/gridpoints/TOP/32,81/forecast",
              forecastHourly:
                "https://api.weather.gov/gridpoints/TOP/32,81/forecast/hourly",
              observationStations:
                "https://api.weather.gov/gridpoints/TOP/32,81/stations",
              forecastZone: "https://api.weather.gov/zones/forecast/KSZ009",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/geo+json",
              "x-request-id": "req-123",
              "x-correlation-id": "corr-123",
              "x-server-id": "server-1",
              "cache-control": "public, max-age=3600",
            },
          },
        );
      },
    });

    const result = await client.resolvePoint(39.7456, -97.0892);

    expect(String(seenRequests[0]?.input)).toBe(
      "https://api.weather.gov/points/39.7456,-97.0892",
    );

    const headers = new Headers(seenRequests[0]?.init?.headers);
    expect(headers.get("Accept")).toBe("application/geo+json");
    expect(headers.get("User-Agent")).toBe("(WindAppForGreg, greg@example.com)");
    expect(headers.get("Accept-Language")).toBe("en-US");
    expect(headers.get("Feature-Flags")).toBe("forecast_temperature_qv");

    expect(result.meta.requestId).toBe("req-123");
    expect(result.meta.correlationId).toBe("corr-123");
    expect(result.meta.serverId).toBe("server-1");
    expect(result.meta.cacheControl).toBe("public, max-age=3600");
  });

  test("request surfaces RFC 7807 problem details", async () => {
    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      maxRetries: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Service unavailable",
            status: 503,
            detail: "The upstream service is temporarily unavailable.",
            correlationId: "corr-503",
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/problem+json",
              "x-request-id": "req-503",
            },
          },
        ),
    });

    await expect(client.getActiveAlertsByArea("KS")).rejects.toMatchObject({
      status: 503,
      problem: {
        detail: "The upstream service is temporarily unavailable.",
      },
      meta: {
        url: "https://api.weather.gov/alerts/active/area/KS",
        status: 503,
        ok: false,
        contentType: "application/problem+json",
        requestId: "req-503",
      },
    } satisfies Partial<WeatherGovRequestError>);
  });

  test("custom baseUrl prefixes relative endpoint paths", async () => {
    const urls: string[] = [];

    const client = new WeatherGovClient({
      baseUrl: "https://example.test/weather-gov",
      userAgent: "(WindAppForGreg, greg@example.com)",
      fetch: async (input) => {
        urls.push(String(input));
        return jsonResponse({
          type: "Feature",
          properties: {
            forecastZone: "https://api.weather.gov/zones/forecast/KSZ009",
          },
        });
      },
    });

    await client.resolvePoint(39.7456, -97.0892);

    expect(urls).toEqual([
      "https://example.test/weather-gov/points/39.7456,-97.0892",
    ]);
  });

  test("getStations builds the official query string for the top-level stations endpoint", async () => {
    const urls: string[] = [];

    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      fetch: async (input) => {
        urls.push(String(input));
        return jsonResponse({
          type: "FeatureCollection",
          features: [],
        });
      },
    });

    await client.getStations({
      ids: ["KTOP", "KCON"],
      states: ["KS", "CO"],
      limit: 10,
      cursor: "abc123",
    });

    expect(urls).toHaveLength(1);

    const requestUrl = new URL(urls[0]!);
    expect(requestUrl.origin + requestUrl.pathname).toBe("https://api.weather.gov/stations");
    expect(requestUrl.searchParams.get("id")).toBe("KTOP,KCON");
    expect(requestUrl.searchParams.get("state")).toBe("KS,CO");
    expect(requestUrl.searchParams.get("limit")).toBe("10");
    expect(requestUrl.searchParams.get("cursor")).toBe("abc123");
  });

  test("getLatestObservationForPoint follows the point and station links", async () => {
    const urls: string[] = [];

    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      fetch: async (input) => {
        const url = String(input);
        urls.push(url);

        if (url.endsWith("/points/39.7456,-97.0892")) {
          return jsonResponse({
            type: "Feature",
            properties: {
              observationStations:
                "https://api.weather.gov/gridpoints/TOP/32,81/stations",
              forecastZone: "https://api.weather.gov/zones/forecast/KSZ009",
            },
          });
        }

        if (url.endsWith("/gridpoints/TOP/32,81/stations")) {
          return jsonResponse({
            type: "FeatureCollection",
            features: [
              {
                id: "https://api.weather.gov/stations/KTOP",
                type: "Feature",
                properties: {
                  stationIdentifier: "KTOP",
                  name: "Topeka",
                },
              },
            ],
          });
        }

        if (url.endsWith("/stations/KTOP/observations/latest?require_qc=true")) {
          return jsonResponse({
            type: "Feature",
            properties: {
              timestamp: "2026-04-23T18:15:00+00:00",
              textDescription: "Cloudy",
            },
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    const result = await client.getLatestObservationForPoint(39.7456, -97.0892, {
      requireQc: true,
    });

    expect(urls).toEqual([
      "https://api.weather.gov/points/39.7456,-97.0892",
      "https://api.weather.gov/gridpoints/TOP/32,81/stations",
      "https://api.weather.gov/stations/KTOP/observations/latest?require_qc=true",
    ]);

    expect(result.station.properties.stationIdentifier).toBe("KTOP");
    expect(result.observation.data.properties.textDescription).toBe("Cloudy");
  });

  test("getHourlyForecastForPoint only sends units to the hourly forecast endpoint", async () => {
    const urls: string[] = [];

    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      fetch: async (input) => {
        const url = String(input);
        urls.push(url);

        if (url.endsWith("/points/39.7456,-97.0892")) {
          return jsonResponse({
            type: "Feature",
            properties: {
              forecastHourly:
                "https://api.weather.gov/gridpoints/TOP/32,81/forecast/hourly",
            },
          });
        }

        if (url.endsWith("/gridpoints/TOP/32,81/forecast/hourly?units=us")) {
          return jsonResponse({
            type: "Feature",
            properties: {
              periods: [],
            },
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    await client.getHourlyForecastForPoint(39.7456, -97.0892, {
      units: "us",
    });

    expect(urls).toEqual([
      "https://api.weather.gov/points/39.7456,-97.0892",
      "https://api.weather.gov/gridpoints/TOP/32,81/forecast/hourly?units=us",
    ]);
  });

  test("getActiveAlertsForPoint derives the forecast zone from the point response", async () => {
    const urls: string[] = [];

    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, greg@example.com)",
      fetch: async (input) => {
        const url = String(input);
        urls.push(url);

        if (url.endsWith("/points/39.7456,-97.0892")) {
          return jsonResponse({
            type: "Feature",
            properties: {
              forecastZone: "https://api.weather.gov/zones/forecast/KSZ009",
            },
          });
        }

        if (url.endsWith("/alerts/active/zone/KSZ009")) {
          return jsonResponse({
            type: "FeatureCollection",
            features: [
              {
                id: "alert-1",
                type: "Feature",
                properties: {
                  event: "Special Weather Statement",
                  severity: "Moderate",
                },
              },
            ],
          });
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    const result = await client.getActiveAlertsForPoint(39.7456, -97.0892);

    expect(urls).toEqual([
      "https://api.weather.gov/points/39.7456,-97.0892",
      "https://api.weather.gov/alerts/active/zone/KSZ009",
    ]);

    expect(result.response.data.features[0]?.properties.event).toBe(
      "Special Weather Statement",
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/geo+json",
    },
  });
}
