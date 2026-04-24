import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTrpcContext } from "../trpc/context.ts";
import { appRouter } from "../trpc/router.ts";
import type { TrpcEnv } from "../trpc/context.ts";

const TRPC_ENDPOINT = "/trpc";

export function handleTrpcRequest(
  request: Request,
  env: TrpcEnv,
): Promise<Response> | null {
  const requestUrl = new URL(request.url);

  if (
    requestUrl.pathname !== TRPC_ENDPOINT &&
    !requestUrl.pathname.startsWith(`${TRPC_ENDPOINT}/`)
  ) {
    return null;
  }

  return fetchRequestHandler({
    endpoint: TRPC_ENDPOINT,
    req: request,
    router: appRouter,
    createContext: createTrpcContext(env),
  });
}
