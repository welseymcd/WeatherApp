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

      const periods = result.response.data.properties.periods.slice(0, 24);

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
});
