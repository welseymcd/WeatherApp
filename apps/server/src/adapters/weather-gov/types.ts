export type WeatherGovUnits = "us" | "si";

export type WeatherGovJsonObject = Record<string, unknown>;

export type WeatherGovQueryScalar = string | number | boolean;
export type WeatherGovQueryValue =
  | WeatherGovQueryScalar
  | readonly WeatherGovQueryScalar[]
  | null
  | undefined;

export type WeatherGovProblemDetail = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  [key: string]: unknown;
};

export type WeatherGovResponseMeta = {
  url: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  requestId?: string;
  correlationId?: string;
  serverId?: string;
  cacheControl?: string;
  expires?: string;
};

export type WeatherGovApiResponse<T> = {
  data: T;
  meta: WeatherGovResponseMeta;
};

export type WeatherGovQuantitativeValue = {
  unitCode?: string;
  value: number | null;
  qualityControl?: string | null;
};

export type WeatherGovGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: unknown[];
  [key: string]: unknown;
} | null;

export type WeatherGovGeoJsonFeature<TProperties> = {
  id?: string | number;
  type: "Feature";
  geometry?: WeatherGovGeometry;
  properties: TProperties;
  [key: string]: unknown;
};

export type WeatherGovGeoJsonFeatureCollection<TProperties> = {
  type: "FeatureCollection";
  features: Array<WeatherGovGeoJsonFeature<TProperties>>;
  pagination?: {
    next?: string;
    prev?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type WeatherGovRelativeLocation = WeatherGovGeoJsonFeature<{
  city?: string;
  state?: string;
  distance?: WeatherGovQuantitativeValue;
  bearing?: WeatherGovQuantitativeValue;
  [key: string]: unknown;
}>;

export type WeatherGovPointProperties = {
  "@id"?: string;
  cwa?: string;
  forecast?: string;
  forecastHourly?: string;
  forecastGridData?: string;
  observationStations?: string;
  forecastZone?: string;
  county?: string;
  fireWeatherZone?: string;
  gridId?: string;
  gridX?: number;
  gridY?: number;
  radarStation?: string;
  relativeLocation?: WeatherGovRelativeLocation;
  timeZone?: string;
  [key: string]: unknown;
};

export type WeatherGovPoint = WeatherGovGeoJsonFeature<WeatherGovPointProperties>;

export type WeatherGovForecastPeriod = {
  number: number;
  name?: string;
  startTime?: string;
  endTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  temperatureUnit?: string;
  temperatureTrend?: string | null;
  probabilityOfPrecipitation?: WeatherGovQuantitativeValue;
  dewpoint?: WeatherGovQuantitativeValue;
  relativeHumidity?: WeatherGovQuantitativeValue;
  windSpeed?: string;
  windDirection?: string;
  icon?: string;
  shortForecast?: string;
  detailedForecast?: string;
  [key: string]: unknown;
};

export type WeatherGovForecastProperties = {
  "@id"?: string;
  updated?: string;
  units?: string;
  forecastGenerator?: string;
  generatedAt?: string;
  updateTime?: string;
  validTimes?: string;
  elevation?: WeatherGovQuantitativeValue;
  periods: WeatherGovForecastPeriod[];
  [key: string]: unknown;
};

export type WeatherGovForecast = WeatherGovGeoJsonFeature<WeatherGovForecastProperties>;

export type WeatherGovGridpointProperties = {
  "@id"?: string;
  updateTime?: string;
  validTimes?: string;
  elevation?: WeatherGovQuantitativeValue;
  [key: string]: unknown;
};

export type WeatherGovGridpoint = WeatherGovGeoJsonFeature<WeatherGovGridpointProperties>;

export type WeatherGovStationProperties = {
  "@id"?: string;
  stationIdentifier?: string;
  name?: string;
  timeZone?: string;
  forecast?: string;
  county?: string;
  fireWeatherZone?: string;
  [key: string]: unknown;
};

export type WeatherGovStation = WeatherGovGeoJsonFeature<WeatherGovStationProperties>;

export type WeatherGovStationCollection =
  WeatherGovGeoJsonFeatureCollection<WeatherGovStationProperties>;

export type WeatherGovObservationProperties = {
  "@id"?: string;
  station?: string;
  timestamp?: string;
  rawMessage?: string;
  textDescription?: string;
  icon?: string;
  presentWeather?: unknown[];
  temperature?: WeatherGovQuantitativeValue;
  dewpoint?: WeatherGovQuantitativeValue;
  windDirection?: WeatherGovQuantitativeValue;
  windSpeed?: WeatherGovQuantitativeValue;
  windGust?: WeatherGovQuantitativeValue;
  barometricPressure?: WeatherGovQuantitativeValue;
  seaLevelPressure?: WeatherGovQuantitativeValue;
  visibility?: WeatherGovQuantitativeValue;
  maxTemperatureLast24Hours?: WeatherGovQuantitativeValue;
  minTemperatureLast24Hours?: WeatherGovQuantitativeValue;
  precipitationLastHour?: WeatherGovQuantitativeValue;
  precipitationLast3Hours?: WeatherGovQuantitativeValue;
  precipitationLast6Hours?: WeatherGovQuantitativeValue;
  relativeHumidity?: WeatherGovQuantitativeValue;
  windChill?: WeatherGovQuantitativeValue;
  heatIndex?: WeatherGovQuantitativeValue;
  cloudLayers?: unknown[];
  [key: string]: unknown;
};

export type WeatherGovObservation =
  WeatherGovGeoJsonFeature<WeatherGovObservationProperties>;

export type WeatherGovAlertProperties = {
  "@id"?: string;
  id?: string;
  areaDesc?: string;
  geocode?: WeatherGovJsonObject;
  affectedZones?: string[];
  references?: unknown[];
  sent?: string;
  effective?: string;
  onset?: string;
  expires?: string;
  ends?: string | null;
  status?: string;
  messageType?: string;
  category?: string;
  severity?: string;
  certainty?: string;
  urgency?: string;
  event?: string;
  sender?: string;
  senderName?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  response?: string;
  parameters?: WeatherGovJsonObject;
  [key: string]: unknown;
};

export type WeatherGovAlert = WeatherGovGeoJsonFeature<WeatherGovAlertProperties>;

export type WeatherGovAlertCollection =
  WeatherGovGeoJsonFeatureCollection<WeatherGovAlertProperties>;

export type WeatherGovActiveAlertCount = {
  total?: number;
  land?: number;
  marine?: number;
  regions?: Record<string, number>;
  areas?: Record<string, number>;
  zones?: Record<string, number>;
  [key: string]: unknown;
};

export type WeatherGovRequestOptions = {
  headers?: HeadersInit;
  query?: Record<string, WeatherGovQueryValue>;
  acceptLanguage?: string;
  featureFlags?: string[];
};

export type WeatherGovForecastRequestOptions = WeatherGovRequestOptions & {
  units?: WeatherGovUnits;
};

export type WeatherGovLatestObservationRequestOptions =
  WeatherGovRequestOptions & {
    requireQc?: boolean;
  };

export type WeatherGovAlertsQuery = WeatherGovRequestOptions & {
  start?: string;
  end?: string;
  status?: string;
  messageType?: string;
  event?: string;
  code?: string;
  area?: string;
  point?: string;
  region?: string;
  regionType?: string;
  zone?: string;
  urgency?: string;
  severity?: string;
  certainty?: string;
  limit?: number;
  cursor?: string;
};

export type WeatherGovStationsQuery = WeatherGovRequestOptions & {
  ids?: readonly string[];
  states?: readonly string[];
  limit?: number;
  cursor?: string;
};

export type WeatherGovPointLinkedResponse<T> = {
  point: WeatherGovApiResponse<WeatherGovPoint>;
  response: WeatherGovApiResponse<T>;
};

export type WeatherGovPointObservationResponse = {
  point: WeatherGovApiResponse<WeatherGovPoint>;
  stations: WeatherGovApiResponse<WeatherGovStationCollection>;
  station: WeatherGovStation;
  observation: WeatherGovApiResponse<WeatherGovObservation>;
};
