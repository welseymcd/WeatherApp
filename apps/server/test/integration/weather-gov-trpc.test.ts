import { describe, expect, test } from "vitest";

import worker from "../../src/index.ts";

describe("weatherGov tRPC router", () => {
  test("serves weatherGov.resolvePoint as a valid tRPC procedure", async () => {
    const response = await worker.fetch(
      trpcRequest("weatherGov.resolvePoint", {
        latitude: 39.7456,
        longitude: -97.0892,
      }),
      {
        NWS_USER_AGENT: "(WindAppForGreg, test@example.com)",
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    const payload = getTrpcJsonPayload<{
      data?: {
        properties?: {
          gridId?: string;
        };
      };
      meta?: {
        status?: number;
      };
    }>(body);

    expect(payload?.meta?.status).toBe(200);
    expect(payload?.data?.properties?.gridId).toBeTruthy();
  });

  test("rejects invalid Zod input before the SDK runs", async () => {
    const response = await worker.fetch(
      trpcRequest("weatherGov.resolvePoint", {
        latitude: 120,
        longitude: -97.0892,
      }),
      {},
    );

    expect(response.status).toBe(400);

    const body = await response.json() as {
      error?: {
        message?: string;
        code?: number;
        data?: {
          code?: string;
        };
      };
    };

    expect(body.error?.data?.code).toBe("BAD_REQUEST");
    expect(body.error?.message).toContain("Too big");
  });

  test("serves weatherGov.getStations with Zod-validated optional input", async () => {
    const response = await worker.fetch(
      trpcRequest("weatherGov.getStations", {
        ids: ["KTOP"],
        states: ["KS"],
        limit: 5,
      }),
      {
        NWS_USER_AGENT: "(WindAppForGreg, test@example.com)",
      },
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    const payload = getTrpcJsonPayload<{
      data?: {
        type?: string;
        features?: unknown[];
      };
    }>(body);

    expect(payload?.data?.type).toBe("FeatureCollection");
    expect(payload?.data?.features?.length).toBeGreaterThan(0);
  });
});

function trpcRequest(procedurePath: string, input: unknown): Request {
  const url = new URL(`https://example.test/trpc/${procedurePath}`);
  url.searchParams.set("input", JSON.stringify(input));

  return new Request(url);
}

function getTrpcJsonPayload<T>(body: unknown): T | undefined {
  const result = body as {
    result?: {
      data?: {
        json?: T;
      } | T;
    };
  };

  const data = result.result?.data;
  if (data && typeof data === "object" && "json" in data) {
    return data.json;
  }

  return data as T | undefined;
}
