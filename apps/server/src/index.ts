import { handleEmailRequest } from "./routes/email.ts";
import { handleWeatherGovProxyRequest } from "./routes/weather-gov-proxy.ts";
import { handleTrpcRequest } from "./routes/trpc.ts";

export type Env = {
  EMAIL?: SendEmail;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  NWS_USER_AGENT?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const emailResponse = await handleEmailRequest(request, env);

    if (emailResponse) {
      return emailResponse;
    }

    const trpcResponse = handleTrpcRequest(request, env);

    if (trpcResponse) {
      return trpcResponse;
    }

    const weatherGovResponse = await handleWeatherGovProxyRequest(request, env);

    if (weatherGovResponse) {
      return weatherGovResponse;
    }

    return Response.json(
      {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "No route matched the requested path.",
      },
      {
        status: 404,
      },
    );
  },
};
