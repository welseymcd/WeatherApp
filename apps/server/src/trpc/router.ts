import { router } from "./init.ts";
import { weatherGovRouter } from "./routers/weather-gov.ts";

export const appRouter = router({
  weatherGov: weatherGovRouter,
});

export type AppRouter = typeof appRouter;
