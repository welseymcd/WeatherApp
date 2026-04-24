import * as z from "zod";

import {
  OptionalHeadersSchema,
  PaginationInputSchema,
  PointLocationInputSchema,
  WeatherGovUnitsSchema,
} from "../base/schemas.ts";

export const WeatherGovRawPathInputSchema = OptionalHeadersSchema.extend({
  pathOrUrl: z.string().trim().min(1),
});

export const WeatherGovForecastInputSchema = WeatherGovRawPathInputSchema.extend({
  units: WeatherGovUnitsSchema.optional(),
});

export const WeatherGovPointForecastInputSchema = PointLocationInputSchema
  .merge(OptionalHeadersSchema)
  .extend({
    units: WeatherGovUnitsSchema.optional(),
  });

export const WeatherGovStationIdInputSchema = OptionalHeadersSchema.extend({
  stationIdOrUrl: z.string().trim().min(1),
});

export const WeatherGovLatestObservationInputSchema =
  WeatherGovStationIdInputSchema.extend({
    requireQc: z.boolean().optional(),
  });

export const WeatherGovPointLatestObservationInputSchema =
  PointLocationInputSchema.merge(OptionalHeadersSchema).extend({
    requireQc: z.boolean().optional(),
  });

export const WeatherGovStationsInputSchema = PaginationInputSchema
  .merge(OptionalHeadersSchema)
  .extend({
    ids: z.array(z.string().trim().min(1)).optional(),
    states: z.array(z.string().trim().min(1)).optional(),
  });

export const WeatherGovAlertsInputSchema = PaginationInputSchema
  .merge(OptionalHeadersSchema)
  .extend({
    start: z.string().trim().min(1).optional(),
    end: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    messageType: z.string().trim().min(1).optional(),
    event: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    area: z.string().trim().min(1).optional(),
    point: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    regionType: z.string().trim().min(1).optional(),
    zone: z.string().trim().min(1).optional(),
    urgency: z.string().trim().min(1).optional(),
    severity: z.string().trim().min(1).optional(),
    certainty: z.string().trim().min(1).optional(),
  });

export const WeatherGovAreaInputSchema = OptionalHeadersSchema.extend({
  area: z.string().trim().min(1),
});

export const WeatherGovZoneInputSchema = OptionalHeadersSchema.extend({
  zoneIdOrUrl: z.string().trim().min(1),
});

export const WeatherGovPointInputSchema =
  PointLocationInputSchema.merge(OptionalHeadersSchema);

export const WeatherGovZipInputSchema = z.object({
  zipCode: z.string().trim().min(5).max(10),
  units: WeatherGovUnitsSchema.optional(),
});

export type WeatherGovRawPathInput = z.infer<typeof WeatherGovRawPathInputSchema>;
export type WeatherGovForecastInput = z.infer<typeof WeatherGovForecastInputSchema>;
export type WeatherGovPointForecastInput = z.infer<
  typeof WeatherGovPointForecastInputSchema
>;
export type WeatherGovStationIdInput = z.infer<typeof WeatherGovStationIdInputSchema>;
export type WeatherGovLatestObservationInput = z.infer<
  typeof WeatherGovLatestObservationInputSchema
>;
export type WeatherGovPointLatestObservationInput = z.infer<
  typeof WeatherGovPointLatestObservationInputSchema
>;
export type WeatherGovStationsInput = z.infer<typeof WeatherGovStationsInputSchema>;
export type WeatherGovAlertsInput = z.infer<typeof WeatherGovAlertsInputSchema>;
export type WeatherGovAreaInput = z.infer<typeof WeatherGovAreaInputSchema>;
export type WeatherGovZoneInput = z.infer<typeof WeatherGovZoneInputSchema>;
export type WeatherGovPointInput = z.infer<typeof WeatherGovPointInputSchema>;
export type WeatherGovZipInput = z.infer<typeof WeatherGovZipInputSchema>;
