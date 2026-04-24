import * as z from "zod";

export const LatitudeSchema = z.number().finite().min(-90).max(90);

export const LongitudeSchema = z.number().finite().min(-180).max(180);

export const PointLocationInputSchema = z.object({
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
});

export const WeatherGovUnitsSchema = z.enum(["us", "si"]);

export const OptionalHeadersSchema = z.object({
  acceptLanguage: z.string().trim().min(1).optional(),
  featureFlags: z.array(z.string().trim().min(1)).optional(),
});

export const PaginationInputSchema = z.object({
  limit: z.number().int().positive().max(500).optional(),
  cursor: z.string().trim().min(1).optional(),
});

export type PointLocationInput = z.infer<typeof PointLocationInputSchema>;
export type WeatherGovUnits = z.infer<typeof WeatherGovUnitsSchema>;
export type OptionalHeadersInput = z.infer<typeof OptionalHeadersSchema>;
export type PaginationInput = z.infer<typeof PaginationInputSchema>;
