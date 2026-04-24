import {
  WeatherGovAlertsInputSchema,
  WeatherGovAreaInputSchema,
  WeatherGovForecastInputSchema,
  WeatherGovLatestObservationInputSchema,
  WeatherGovPointForecastInputSchema,
  WeatherGovPointInputSchema,
  WeatherGovPointLatestObservationInputSchema,
  WeatherGovRawPathInputSchema,
  WeatherGovStationIdInputSchema,
  WeatherGovStationsInputSchema,
  WeatherGovZoneInputSchema,
  WeatherGovZipInputSchema,
} from "../../../../../packages/contracts/src/index.ts";
import { publicProcedure, router } from "../init.ts";

type ZippopotamPlace = {
  "place name": string;
  longitude: string;
  latitude: string;
  state: string;
  "state abbreviation": string;
};

type ZippopotamResponse = {
  "post code": string;
  country: string;
  "country abbreviation": string;
  places: ZippopotamPlace[];
};

type WeatherGovGridValue = {
  validTime?: string;
  value?: number | null;
};

type WeatherGovGridLayer = {
  uom?: string;
  values: WeatherGovGridValue[];
};

function getGridLayer(value: unknown): WeatherGovGridLayer {
  if (!value || typeof value !== "object" || !("values" in value)) {
    return { values: [] };
  }
  const layer = value as { uom?: unknown; values?: unknown };
  const values = layer.values;
  if (!Array.isArray(values)) {
    return { values: [] };
  }
  return {
    uom: typeof layer.uom === "string" ? layer.uom : undefined,
    values: values.filter(
      (item): item is WeatherGovGridValue =>
        Boolean(item) && typeof item === "object" && "validTime" in item,
    ),
  };
}

function validTimeCoversStart(validTime: string | undefined, startTime: string) {
  if (!validTime) return false;
  const [start, duration] = validTime.split("/");
  const validStart = new Date(start);
  const periodStart = new Date(startTime);
  if (Number.isNaN(validStart.getTime()) || Number.isNaN(periodStart.getTime())) {
    return false;
  }
  const hours = duration?.match(/^PT(\d+)H$/)?.[1];
  const validEnd = new Date(validStart);
  validEnd.setHours(validEnd.getHours() + Number(hours ?? 1));
  return validStart <= periodStart && periodStart < validEnd;
}

function convertWindSpeedToMph(value: number, uom?: string) {
  if (uom === "wmoUnit:km_h-1") {
    return Math.round(value * 0.621371);
  }
  if (uom === "wmoUnit:m_s-1") {
    return Math.round(value * 2.23694);
  }
  if (uom === "wmoUnit:mi_h-1") {
    return Math.round(value);
  }
  return Math.round(value * 2.23694);
}

function formatWindGust(value: number | null | undefined, uom?: string) {
  if (value === null || value === undefined) return undefined;
  return `${convertWindSpeedToMph(value, uom)} mph`;
}

async function geocodeZipCode(zipCode: string): Promise<{ latitude: number; longitude: number; place: string; state: string }> {
  const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zipCode)}`, {
    headers: { "User-Agent": "(WindAppForGreg, weather.rmcd.cc)" },
  });

  if (!response.ok) {
    throw new Error(`Zip code lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as ZippopotamResponse;
  const place = data.places[0];

  if (!place) {
    throw new Error("No location found for zip code");
  }

  return {
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    place: place["place name"],
    state: place["state abbreviation"],
  };
}

export const weatherGovRouter = router({
  resolvePoint: publicProcedure
    .input(WeatherGovPointInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.resolvePoint(input.latitude, input.longitude, input),
    ),

  getForecast: publicProcedure
    .input(WeatherGovForecastInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getForecast(input.pathOrUrl, input),
    ),

  getHourlyForecast: publicProcedure
    .input(WeatherGovForecastInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getHourlyForecast(input.pathOrUrl, input),
    ),

  getGridpoint: publicProcedure
    .input(WeatherGovRawPathInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getGridpoint(input.pathOrUrl, input),
    ),

  getObservationStations: publicProcedure
    .input(WeatherGovRawPathInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getObservationStations(input.pathOrUrl, input),
    ),

  getStations: publicProcedure
    .input(WeatherGovStationsInputSchema.optional())
    .query(({ ctx, input }) => ctx.weatherGov.getStations(input ?? {})),

  getStation: publicProcedure
    .input(WeatherGovStationIdInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getStation(input.stationIdOrUrl, input),
    ),

  getLatestObservation: publicProcedure
    .input(WeatherGovLatestObservationInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getLatestObservation(input.stationIdOrUrl, input),
    ),

  getActiveAlerts: publicProcedure
    .input(WeatherGovAlertsInputSchema.optional())
    .query(({ ctx, input }) => ctx.weatherGov.getActiveAlerts(input ?? {})),

  getActiveAlertsByArea: publicProcedure
    .input(WeatherGovAreaInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getActiveAlertsByArea(input.area, input),
    ),

  getActiveAlertsByZone: publicProcedure
    .input(WeatherGovZoneInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getActiveAlertsByZone(input.zoneIdOrUrl, input),
    ),

  getActiveAlertCount: publicProcedure
    .input(WeatherGovRawPathInputSchema.omit({ pathOrUrl: true }).optional())
    .query(({ ctx, input }) => ctx.weatherGov.getActiveAlertCount(input ?? {})),

  getForecastForPoint: publicProcedure
    .input(WeatherGovPointForecastInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getForecastForPoint(input.latitude, input.longitude, input),
    ),

  getHourlyForecastForPoint: publicProcedure
    .input(WeatherGovPointForecastInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getHourlyForecastForPoint(
        input.latitude,
        input.longitude,
        input,
      ),
    ),

  getObservationStationsForPoint: publicProcedure
    .input(WeatherGovPointInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getObservationStationsForPoint(
        input.latitude,
        input.longitude,
        input,
      ),
    ),

  getLatestObservationForPoint: publicProcedure
    .input(WeatherGovPointLatestObservationInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getLatestObservationForPoint(
        input.latitude,
        input.longitude,
        input,
      ),
    ),

  getActiveAlertsForPoint: publicProcedure
    .input(WeatherGovPointInputSchema)
    .query(({ ctx, input }) =>
      ctx.weatherGov.getActiveAlertsForPoint(
        input.latitude,
        input.longitude,
        input,
      ),
    ),

	  getHourlyForecastForZip: publicProcedure
	    .input(WeatherGovZipInputSchema)
	    .query(async ({ ctx, input }) => {
	      const location = await geocodeZipCode(input.zipCode);
	      const result = await ctx.weatherGov.getHourlyForecastForPoint(
	        location.latitude,
	        location.longitude,
	        { units: input.units },
	      );

	      let windGustLayer: WeatherGovGridLayer = { values: [] };
	      const gridpointUrl = result.point.data.properties.forecastGridData;
	      if (gridpointUrl) {
	        const gridpoint = await ctx.weatherGov.getGridpoint(gridpointUrl);
	        windGustLayer = getGridLayer(gridpoint.data.properties.windGust);
	      }

	      const periods = result.response.data.properties.periods
	        .slice(0, 24)
	        .map((period) => {
	          const gust = windGustLayer.values.find((value) =>
	            period.startTime
	              ? validTimeCoversStart(value.validTime, period.startTime)
	              : false,
	          );
	          return {
	            ...period,
	            windGust: formatWindGust(gust?.value, windGustLayer.uom),
	          };
	        });

      return {
        location,
        point: result.point,
        response: {
          ...result.response,
          data: {
            ...result.response.data,
            properties: {
              ...result.response.data.properties,
              periods,
            },
          },
        },
      };
    }),

  getNearestRadarStation: publicProcedure
    .input(WeatherGovPointInputSchema)
    .query(async ({ ctx, input }) => {
      const station = await ctx.weatherGov.getNearestRadarStation(
        input.latitude,
        input.longitude,
      );
      return station;
    }),
});
