import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

import { WeatherGovClient } from "../adapters/weather-gov/index.ts";

export type TrpcEnv = {
  NWS_USER_AGENT?: string;
};

export type TrpcContext = {
  env: TrpcEnv;
  weatherGov: WeatherGovClient;
};

export function createTrpcContext(
  env: TrpcEnv,
): (options: FetchCreateContextFnOptions) => TrpcContext {
  return () => ({
    env,
    weatherGov: new WeatherGovClient({
      userAgent: env.NWS_USER_AGENT,
    }),
  });
}
