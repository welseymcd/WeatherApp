import {
  WeatherGovClient,
  WeatherGovRequestError,
} from "../adapters/weather-gov/index.ts";
import type { WeatherGovJsonObject } from "../adapters/weather-gov/index.ts";

const WEATHER_GOV_ROUTE_PREFIX = "/weather/gov";

export type WeatherGovProxyEnv = {
  NWS_USER_AGENT?: string;
};

export type WeatherGovProxyOptions = {
  client?: WeatherGovClient;
};

export async function handleWeatherGovProxyRequest(
  request: Request,
  env: WeatherGovProxyEnv = {},
  options: WeatherGovProxyOptions = {},
): Promise<Response | null> {
  const requestUrl = new URL(request.url);
  const upstreamPath = getWeatherGovUpstreamPath(requestUrl.pathname);

  if (upstreamPath === null) {
    return null;
  }

  if (request.method !== "GET") {
    return Response.json(
      {
        type: "about:blank",
        title: "Method Not Allowed",
        status: 405,
        detail: "The /weather/gov route only supports GET requests.",
      },
      {
        status: 405,
        headers: {
          Allow: "GET",
        },
      },
    );
  }

  const client =
    options.client ??
    new WeatherGovClient({
      userAgent: env.NWS_USER_AGENT,
    });

  try {
    const upstream = await client.request<unknown>(`${upstreamPath}${requestUrl.search}`, {
      acceptLanguage: request.headers.get("Accept-Language") ?? undefined,
      featureFlags: getFeatureFlags(request.headers.get("Feature-Flags")),
    });

    return jsonResponse(upstream.data, {
      status: upstream.meta.status,
      contentType: upstream.meta.contentType,
      upstreamHeaders: {
        "X-Upstream-Request-Id": upstream.meta.requestId,
        "X-Upstream-Correlation-Id": upstream.meta.correlationId,
        "X-Upstream-Server-Id": upstream.meta.serverId,
        "Cache-Control": upstream.meta.cacheControl,
        Expires: upstream.meta.expires,
      },
    });
  } catch (error) {
    if (error instanceof WeatherGovRequestError) {
      return jsonResponse(error.problem ?? fallbackProblem(error), {
        status: error.status,
        contentType: error.meta.contentType ?? "application/problem+json",
        upstreamHeaders: {
          "X-Upstream-Request-Id": error.meta.requestId,
          "X-Upstream-Correlation-Id": error.meta.correlationId,
          "X-Upstream-Server-Id": error.meta.serverId,
          "Cache-Control": error.meta.cacheControl,
          Expires: error.meta.expires,
        },
      });
    }

    throw error;
  }
}

export function getWeatherGovUpstreamPath(pathname: string): string | null {
  if (pathname === WEATHER_GOV_ROUTE_PREFIX) {
    return "/";
  }

  if (!pathname.startsWith(`${WEATHER_GOV_ROUTE_PREFIX}/`)) {
    return null;
  }

  const upstreamPath = pathname.slice(WEATHER_GOV_ROUTE_PREFIX.length);
  return upstreamPath.length > 0 ? upstreamPath : "/";
}

function getFeatureFlags(headerValue: string | null): string[] | undefined {
  const featureFlags = headerValue
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return featureFlags && featureFlags.length > 0 ? featureFlags : undefined;
}

function jsonResponse(
  body: unknown,
  options: {
    status: number;
    contentType: string | null;
    upstreamHeaders: Record<string, string | undefined>;
  },
): Response {
  const headers = new Headers();
  headers.set("Content-Type", options.contentType ?? "application/json");

  for (const [key, value] of Object.entries(options.upstreamHeaders)) {
    if (value) {
      headers.set(key, value);
    }
  }

  return new Response(JSON.stringify(body), {
    status: options.status,
    headers,
  });
}

function fallbackProblem(error: WeatherGovRequestError): WeatherGovJsonObject {
  return {
    type: "about:blank",
    title: "weather.gov request failed",
    status: error.status,
    detail: error.message,
  };
}
