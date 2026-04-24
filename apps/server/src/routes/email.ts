import { SendEmailInputSchema } from "../../../../packages/contracts/src/index.ts";
import type { SendEmailInput } from "../../../../packages/contracts/src/index.ts";

const EMAIL_ROUTE = "/api/email/send";

export type EmailEnv = {
  EMAIL?: SendEmail;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
};

export async function handleEmailRequest(
  request: Request,
  env: EmailEnv,
): Promise<Response | null> {
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname !== EMAIL_ROUTE) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return problemResponse(405, "Method Not Allowed", "Use POST to send email.", {
      Allow: "POST, OPTIONS",
    });
  }

  const authProblem = validateAuthorization(request, env);
  if (authProblem) {
    return authProblem;
  }

  if (!env.EMAIL) {
    return problemResponse(
      503,
      "Email Service Unavailable",
      "The Cloudflare Email Service binding is not configured.",
    );
  }

  if (!env.EMAIL_FROM) {
    return problemResponse(
      503,
      "Email Sender Unavailable",
      "The EMAIL_FROM environment variable is not configured.",
    );
  }

  const parsedBody = await parseEmailBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  try {
    const result = await env.EMAIL.send(toCloudflareEmail(env.EMAIL_FROM, parsedBody.data));

    return jsonResponse(
      {
        messageId: result.messageId,
      },
      { status: 202 },
    );
  } catch (error) {
    return problemResponse(
      502,
      "Email Send Failed",
      error instanceof Error ? error.message : "Cloudflare Email Service rejected the message.",
    );
  }
}

async function parseEmailBody(
  request: Request,
): Promise<{ ok: true; data: SendEmailInput } | { ok: false; response: Response }> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: problemResponse(
        415,
        "Unsupported Media Type",
        "Send email requests must use application/json.",
      ),
    };
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: problemResponse(400, "Invalid JSON", "Request body is not valid JSON."),
    };
  }

  const parsed = SendEmailInputSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      response: problemResponse(
        400,
        "Invalid Email Request",
        parsed.error.issues.map((issue) => issue.message).join(" "),
      ),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

function validateAuthorization(request: Request, env: EmailEnv): Response | null {
  if (!env.EMAIL_API_KEY) {
    return problemResponse(
      503,
      "Email API Key Unavailable",
      "The EMAIL_API_KEY secret is not configured.",
    );
  }

  const expected = `Bearer ${env.EMAIL_API_KEY}`;
  const actual = request.headers.get("Authorization");

  if (actual !== expected) {
    return problemResponse(401, "Unauthorized", "A valid bearer token is required.", {
      "WWW-Authenticate": 'Bearer realm="email"',
    });
  }

  return null;
}

function toCloudflareEmail(
  from: string,
  input: SendEmailInput,
): Parameters<SendEmail["send"]>[0] {
  return {
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  setDefaultHeaders(headers, "application/json");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function problemResponse(
  status: number,
  title: string,
  detail: string,
  headersInit: HeadersInit = {},
): Response {
  const headers = new Headers(headersInit);
  setDefaultHeaders(headers, "application/problem+json");

  return new Response(
    JSON.stringify({
      type: "about:blank",
      title,
      status,
      detail,
    }),
    {
      status,
      headers,
    },
  );
}

function setDefaultHeaders(headers: Headers, contentType: string): void {
  headers.set("Content-Type", contentType);

  for (const [key, value] of corsHeaders()) {
    headers.set(key, value);
  }
}

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
}
