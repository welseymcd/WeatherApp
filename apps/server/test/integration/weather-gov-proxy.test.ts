import { describe, expect, test } from "vitest";

import { WeatherGovClient } from "../../src/adapters/weather-gov/index.ts";
import {
  getWeatherGovUpstreamPath,
  handleWeatherGovProxyRequest,
} from "../../src/routes/weather-gov-proxy.ts";
import worker from "../../src/index.ts";

describe("weather.gov proxy route", () => {
  test.each([
    ["/weather/gov", "/"],
    ["/weather/gov/", "/"],
    ["/weather/gov/points/39.7456,-97.0892", "/points/39.7456,-97.0892"],
    ["/weather/gov/gridpoints/TOP/32,81/forecast", "/gridpoints/TOP/32,81/forecast"],
    ["/other", null],
  ])("maps %s to %s", (pathname, expectedPath) => {
    expect(getWeatherGovUpstreamPath(pathname)).toBe(expectedPath);
  });

  test("proxies GET requests under /weather/gov to the SDK", async () => {
    const requestedUrls: string[] = [];
    const requestedHeaders: Headers[] = [];
    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, test@example.com)",
      fetch: async (input, init) => {
        requestedUrls.push(String(input));
        requestedHeaders.push(new Headers(init?.headers));

        return new Response(
          JSON.stringify({
            type: "Feature",
            properties: {
              gridId: "TOP",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/geo+json",
              "X-Request-Id": "request-1",
              "X-Correlation-Id": "correlation-1",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    });

    const response = await handleWeatherGovProxyRequest(
      new Request(
        "https://example.test/weather/gov/points/39.7456,-97.0892?units=us&feature=one&feature=two",
        {
          headers: {
            "Accept-Language": "en-US",
            "Feature-Flags": "forecast_temperature_qv, forecast_wind_speed_qv",
          },
        },
      ),
      {},
      { client },
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toContain("application/geo+json");
    expect(response?.headers.get("X-Upstream-Request-Id")).toBe("request-1");
    expect(response?.headers.get("X-Upstream-Correlation-Id")).toBe("correlation-1");
    expect(response?.headers.get("Cache-Control")).toBe("public, max-age=3600");
    await expect(response?.json()).resolves.toMatchObject({
      type: "Feature",
      properties: {
        gridId: "TOP",
      },
    });

    expect(requestedUrls).toEqual([
      "https://api.weather.gov/points/39.7456,-97.0892?units=us&feature=one&feature=two",
    ]);
    expect(requestedHeaders[0]?.get("Accept-Language")).toBe("en-US");
    expect(requestedHeaders[0]?.get("Feature-Flags")).toBe(
      "forecast_temperature_qv,forecast_wind_speed_qv",
    );
  });

  test("returns upstream problem details and status", async () => {
    const client = new WeatherGovClient({
      userAgent: "(WindAppForGreg, test@example.com)",
      maxRetries: 0,
      fetch: async () =>
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Not Found",
            status: 404,
            detail: "No station exists for the requested ID.",
          }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/problem+json",
              "X-Request-Id": "request-404",
            },
          },
        ),
    });

    const response = await handleWeatherGovProxyRequest(
      new Request("https://example.test/weather/gov/stations/NOPE"),
      {},
      { client },
    );

    expect(response?.status).toBe(404);
    expect(response?.headers.get("Content-Type")).toContain("application/problem+json");
    expect(response?.headers.get("X-Upstream-Request-Id")).toBe("request-404");
    await expect(response?.json()).resolves.toMatchObject({
      title: "Not Found",
      detail: "No station exists for the requested ID.",
    });
  });

  test("rejects non-GET methods", async () => {
    const response = await handleWeatherGovProxyRequest(
      new Request("https://example.test/weather/gov/stations", {
        method: "POST",
      }),
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get("Allow")).toBe("GET");
  });

  test("falls through for non-weather-gov paths", async () => {
    const response = await handleWeatherGovProxyRequest(
      new Request("https://example.test/trpc/forecast.getByPoint"),
    );

    expect(response).toBeNull();
  });

  test("worker fetch mounts the proxy at /weather/gov", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/not-found"),
      {},
    );

    expect(response.status).toBe(404);
  });
});
