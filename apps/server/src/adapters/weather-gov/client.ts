import {
  WeatherGovClientError,
  WeatherGovRequestError,
} from "./errors.ts";
import type {
  WeatherGovActiveAlertCount,
  WeatherGovAlertCollection,
  WeatherGovAlertsQuery,
  WeatherGovApiResponse,
  WeatherGovForecast,
  WeatherGovForecastRequestOptions,
  WeatherGovGridpoint,
  WeatherGovLatestObservationRequestOptions,
  WeatherGovObservation,
  WeatherGovPoint,
  WeatherGovPointLinkedResponse,
  WeatherGovPointObservationResponse,
  WeatherGovProblemDetail,
  WeatherGovRadarStation,
  WeatherGovRadarStationCollection,
  WeatherGovRequestOptions,
  WeatherGovResponseMeta,
  WeatherGovStation,
  WeatherGovStationCollection,
  WeatherGovStationsQuery,
} from "./types.ts";

const DEFAULT_BASE_URL = "https://api.weather.gov";
const DEFAULT_ACCEPT = "application/geo+json";
const DEFAULT_USER_AGENT = getDefaultUserAgent();
const DEFAULT_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

export type WeatherGovFetch = typeof fetch;

export type WeatherGovClientOptions = {
  baseUrl?: string;
  userAgent?: string;
  fetch?: WeatherGovFetch;
  accept?: string;
  acceptLanguage?: string;
  featureFlags?: string[];
  maxRetries?: number;
  retryBaseDelayMs?: number;
};

type WeatherGovBodyParseResult<T> = {
  data?: T;
  problem?: WeatherGovProblemDetail;
};

export class WeatherGovClient {
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly accept: string;
  readonly acceptLanguage?: string;
  readonly featureFlags: string[];
  readonly maxRetries: number;
  readonly retryBaseDelayMs: number;

  private readonly fetchImpl: WeatherGovFetch;

  constructor(options: WeatherGovClientOptions = {}) {
    const defaultFetch = globalThis.fetch?.bind(globalThis);
    const fetchImpl = options.fetch ?? defaultFetch;

    if (typeof fetchImpl !== "function") {
      throw new WeatherGovClientError(
        "A fetch implementation is required to use WeatherGovClient.",
      );
    }

    this.baseUrl = stripTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.accept = options.accept ?? DEFAULT_ACCEPT;
    this.acceptLanguage = options.acceptLanguage;
    this.featureFlags = options.featureFlags ?? [];
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.retryBaseDelayMs = Math.max(0, options.retryBaseDelayMs ?? 250);
    this.fetchImpl = fetchImpl;
  }

  async request<T>(
    pathOrUrl: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<T>> {
    const url = this.buildUrl(pathOrUrl, options.query);
    let attempt = 0;

    while (true) {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: this.buildHeaders(options),
      });

      const meta = buildResponseMeta(response, url);
      const body = await parseBody<T>(response);

      if (response.ok) {
        if (typeof body.data === "undefined") {
          throw new WeatherGovClientError(
            `weather.gov returned an empty JSON payload for ${url}`,
          );
        }

        return {
          data: body.data,
          meta,
        };
      }

      const error = new WeatherGovRequestError({
        url,
        status: response.status,
        meta,
        problem: body.problem,
      });

      if (attempt < this.maxRetries && shouldRetry(response.status)) {
        attempt += 1;
        await delay(this.retryBaseDelayMs * attempt);
        continue;
      }

      throw error;
    }
  }

  async resolvePoint(
    latitude: number,
    longitude: number,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovPoint>> {
    const normalizedLatitude = formatLatitude(latitude);
    const normalizedLongitude = formatLongitude(longitude);
    return this.request<WeatherGovPoint>(
      `/points/${normalizedLatitude},${normalizedLongitude}`,
      options,
    );
  }

  async getForecast(
    pathOrUrl: string,
    options: WeatherGovForecastRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovForecast>> {
    return this.request<WeatherGovForecast>(pathOrUrl, {
      ...options,
      query: withUnitsQuery(options.query, options.units),
    });
  }

  async getHourlyForecast(
    pathOrUrl: string,
    options: WeatherGovForecastRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovForecast>> {
    return this.request<WeatherGovForecast>(pathOrUrl, {
      ...options,
      query: withUnitsQuery(options.query, options.units),
    });
  }

  async getGridpoint(
    pathOrUrl: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovGridpoint>> {
    return this.request<WeatherGovGridpoint>(pathOrUrl, options);
  }

  async getObservationStations(
    pathOrUrl: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovStationCollection>> {
    return this.request<WeatherGovStationCollection>(pathOrUrl, options);
  }

  async getStations(
    options: WeatherGovStationsQuery = {},
  ): Promise<WeatherGovApiResponse<WeatherGovStationCollection>> {
    return this.request<WeatherGovStationCollection>("/stations", {
      ...options,
      query: {
        ...options.query,
        id: options.ids,
        state: options.states,
        limit: options.limit,
        cursor: options.cursor,
      },
    });
  }

  async getStation(
    stationIdOrUrl: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovStation>> {
    return this.request<WeatherGovStation>(
      buildStationPath(stationIdOrUrl),
      options,
    );
  }

  async getLatestObservation(
    stationIdOrUrl: string,
    options: WeatherGovLatestObservationRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovObservation>> {
    return this.request<WeatherGovObservation>(
      buildLatestObservationPath(stationIdOrUrl),
      {
        ...options,
        query: {
          ...options.query,
          require_qc: options.requireQc ? true : undefined,
        },
      },
    );
  }

  async getActiveAlerts(
    options: WeatherGovAlertsQuery = {},
  ): Promise<WeatherGovApiResponse<WeatherGovAlertCollection>> {
    return this.request<WeatherGovAlertCollection>("/alerts", {
      ...options,
      query: {
        ...options.query,
        start: options.start,
        end: options.end,
        status: options.status,
        message_type: options.messageType,
        event: options.event,
        code: options.code,
        area: options.area,
        point: options.point,
        region: options.region,
        region_type: options.regionType,
        zone: options.zone,
        urgency: options.urgency,
        severity: options.severity,
        certainty: options.certainty,
        limit: options.limit,
        cursor: options.cursor,
      },
    });
  }

  async getActiveAlertsByArea(
    area: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovAlertCollection>> {
    return this.request<WeatherGovAlertCollection>(
      `/alerts/active/area/${encodeURIComponent(area)}`,
      options,
    );
  }

  async getActiveAlertsByZone(
    zoneIdOrUrl: string,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovAlertCollection>> {
    return this.request<WeatherGovAlertCollection>(
      buildActiveAlertsZonePath(zoneIdOrUrl),
      options,
    );
  }

  async getActiveAlertCount(
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovApiResponse<WeatherGovActiveAlertCount>> {
    return this.request<WeatherGovActiveAlertCount>("/alerts/active/count", options);
  }

  async getForecastForPoint(
    latitude: number,
    longitude: number,
    options: WeatherGovForecastRequestOptions = {},
  ): Promise<WeatherGovPointLinkedResponse<WeatherGovForecast>> {
    const point = await this.resolvePoint(
      latitude,
      longitude,
      pointRequestOptions(options),
    );
    const forecastUrl = requireLinkedUrl(point.data.properties.forecast, "forecast");

    return {
      point,
      response: await this.getForecast(forecastUrl, options),
    };
  }

  async getHourlyForecastForPoint(
    latitude: number,
    longitude: number,
    options: WeatherGovForecastRequestOptions = {},
  ): Promise<WeatherGovPointLinkedResponse<WeatherGovForecast>> {
    const point = await this.resolvePoint(
      latitude,
      longitude,
      pointRequestOptions(options),
    );
    const forecastUrl = requireLinkedUrl(
      point.data.properties.forecastHourly,
      "forecastHourly",
    );

    return {
      point,
      response: await this.getHourlyForecast(forecastUrl, options),
    };
  }

  async getObservationStationsForPoint(
    latitude: number,
    longitude: number,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovPointLinkedResponse<WeatherGovStationCollection>> {
    const point = await this.resolvePoint(latitude, longitude, options);
    const stationsUrl = requireLinkedUrl(
      point.data.properties.observationStations,
      "observationStations",
    );

    return {
      point,
      response: await this.getObservationStations(stationsUrl, options),
    };
  }

  async getLatestObservationForPoint(
    latitude: number,
    longitude: number,
    options: WeatherGovLatestObservationRequestOptions = {},
  ): Promise<WeatherGovPointObservationResponse> {
    const point = await this.resolvePoint(latitude, longitude, options);
    const stationsUrl = requireLinkedUrl(
      point.data.properties.observationStations,
      "observationStations",
    );
    const stations = await this.getObservationStations(stationsUrl, options);
    const station = stations.data.features[0];

    if (!station) {
      throw new WeatherGovClientError(
        `weather.gov returned no observation stations for ${stationsUrl}`,
      );
    }

    const stationReference = getStationReference(station);

    return {
      point,
      stations,
      station,
      observation: await this.getLatestObservation(stationReference, options),
    };
  }

  async getActiveAlertsForPoint(
    latitude: number,
    longitude: number,
    options: WeatherGovRequestOptions = {},
  ): Promise<WeatherGovPointLinkedResponse<WeatherGovAlertCollection>> {
    const point = await this.resolvePoint(latitude, longitude, options);
    const zoneUrl = requireLinkedUrl(
      point.data.properties.forecastZone,
      "forecastZone",
    );

    return {
      point,
      response: await this.getActiveAlertsByZone(zoneUrl, options),
    };
  }

  async getRadarStations(): Promise<WeatherGovApiResponse<WeatherGovRadarStationCollection>> {
    return this.request<WeatherGovRadarStationCollection>("/radar/stations");
  }

  async getNearestRadarStation(
    latitude: number,
    longitude: number,
  ): Promise<WeatherGovRadarStation | null> {
    const stations = await this.getRadarStations();
    let nearest: WeatherGovRadarStation | null = null;
    let minDistance = Infinity;

    for (const feature of stations.data.features) {
      const coords = feature.geometry?.coordinates;
      if (
        !Array.isArray(coords) ||
        coords.length < 2 ||
        typeof coords[0] !== "number" ||
        typeof coords[1] !== "number"
      ) {
        continue;
      }
      const distance = haversineDistance(latitude, longitude, coords[1], coords[0]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = feature;
      }
    }

    return nearest;
  }

  private buildUrl(
    pathOrUrl: string,
    query?: WeatherGovRequestOptions["query"],
  ): string {
    const url = isAbsoluteUrl(pathOrUrl)
      ? new URL(pathOrUrl)
      : joinBaseUrl(this.baseUrl, pathOrUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === null || typeof value === "undefined") {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }

        url.searchParams.set(key, value.join(","));
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private buildHeaders(options: WeatherGovRequestOptions): Headers {
    const headers = new Headers(options.headers);

    if (!headers.has("Accept")) {
      headers.set("Accept", this.accept);
    }

    if (!headers.has("User-Agent")) {
      headers.set("User-Agent", this.userAgent);
    }

    const acceptLanguage = options.acceptLanguage ?? this.acceptLanguage;
    if (acceptLanguage && !headers.has("Accept-Language")) {
      headers.set("Accept-Language", acceptLanguage);
    }

    const mergedFeatureFlags = mergeFeatureFlags(
      this.featureFlags,
      options.featureFlags,
    );

    if (mergedFeatureFlags.length > 0 && !headers.has("Feature-Flags")) {
      headers.set("Feature-Flags", mergedFeatureFlags.join(","));
    }

    return headers;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getDefaultUserAgent(): string {
  const processLike = globalThis as {
    process?: {
      env?: {
        NWS_USER_AGENT?: string;
      };
    };
  };

  return processLike.process?.env?.NWS_USER_AGENT ?? "(WindAppForGreg, contact@example.com)";
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function joinBaseUrl(baseUrl: string, pathOrUrl: string): URL {
  const relativePath = pathOrUrl.replace(/^\/+/, "");
  return new URL(relativePath, `${stripTrailingSlash(baseUrl)}/`);
}

function buildResponseMeta(response: Response, url: string): WeatherGovResponseMeta {
  return {
    url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    requestId: response.headers.get("x-request-id") ?? undefined,
    correlationId: response.headers.get("x-correlation-id") ?? undefined,
    serverId: response.headers.get("x-server-id") ?? undefined,
    cacheControl: response.headers.get("cache-control") ?? undefined,
    expires: response.headers.get("expires") ?? undefined,
  };
}

async function parseBody<T>(response: Response): Promise<WeatherGovBodyParseResult<T>> {
  const bodyText = await response.text();

  if (!bodyText.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(bodyText) as T | WeatherGovProblemDetail;
    return response.ok ? { data: parsed as T } : { problem: parsed as WeatherGovProblemDetail };
  } catch (error) {
    if (response.ok) {
      throw new WeatherGovClientError("weather.gov returned invalid JSON", {
        cause: error,
      });
    }

    return {};
  }
}

function shouldRetry(status: number): boolean {
  return DEFAULT_RETRY_STATUSES.has(status);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function mergeFeatureFlags(
  baseFeatureFlags: string[],
  overrideFeatureFlags?: string[],
): string[] {
  return [...new Set([...baseFeatureFlags, ...(overrideFeatureFlags ?? [])])];
}

function withUnitsQuery(
  query: WeatherGovRequestOptions["query"],
  units?: "us" | "si",
): WeatherGovRequestOptions["query"] {
  return {
    ...query,
    units,
  };
}

function pointRequestOptions(
  options: WeatherGovForecastRequestOptions,
): WeatherGovRequestOptions {
  const { units: _units, ...requestOptions } = options;
  return requestOptions;
}

function formatLatitude(value: number): string {
  validateCoordinate(value, "latitude", -90, 90);
  return String(Number(value));
}

function formatLongitude(value: number): string {
  validateCoordinate(value, "longitude", -180, 180);
  return String(Number(value));
}

function validateCoordinate(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new WeatherGovClientError(
      `${label} must be a finite number between ${minimum} and ${maximum}.`,
    );
  }
}

function requireLinkedUrl(value: unknown, propertyName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WeatherGovClientError(
      `weather.gov point response did not include a valid ${propertyName} link.`,
    );
  }

  return value;
}

function getStationReference(station: WeatherGovStation): string {
  const stationId = station.properties.stationIdentifier;
  if (typeof stationId === "string" && stationId.length > 0) {
    return stationId;
  }

  if (typeof station.id === "string" && station.id.length > 0) {
    return station.id;
  }

  const stationUrl = station.properties["@id"];
  if (typeof stationUrl === "string" && stationUrl.length > 0) {
    return stationUrl;
  }

  throw new WeatherGovClientError(
    "weather.gov station payload did not include a usable station identifier.",
  );
}

function buildStationPath(stationIdOrUrl: string): string {
  const url = new URL(stationIdOrUrl, DEFAULT_BASE_URL);
  if (url.pathname.startsWith("/stations/")) {
    return url.pathname + url.search;
  }

  return `/stations/${encodeURIComponent(stationIdOrUrl)}`;
}

function buildLatestObservationPath(stationIdOrUrl: string): string {
  const url = new URL(stationIdOrUrl, DEFAULT_BASE_URL);

  if (url.pathname.endsWith("/observations/latest")) {
    return url.pathname + url.search;
  }

  if (url.pathname.startsWith("/stations/")) {
    const trimmedPath = url.pathname.replace(/\/+$/, "");
    return `${trimmedPath}/observations/latest${url.search}`;
  }

  return `/stations/${encodeURIComponent(
    stationIdOrUrl,
  )}/observations/latest`;
}

function buildActiveAlertsZonePath(zoneIdOrUrl: string): string {
  const url = new URL(zoneIdOrUrl, DEFAULT_BASE_URL);

  if (url.pathname.startsWith("/alerts/active/zone/")) {
    return url.pathname + url.search;
  }

  const zoneId = extractZoneId(url.pathname) ?? zoneIdOrUrl;
  return `/alerts/active/zone/${encodeURIComponent(zoneId)}`;
}

function extractZoneId(pathname: string): string | undefined {
  const match = pathname.match(/\/zones\/[^/]+\/([^/]+)$/);
  return match?.[1];
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
