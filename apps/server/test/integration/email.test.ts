import { describe, expect, test, vi } from "vitest";

import { handleEmailRequest } from "../../src/routes/email.ts";
import worker from "../../src/index.ts";

describe("email route", () => {
  test("falls through for non-email paths", async () => {
    const response = await handleEmailRequest(
      new Request("https://example.test/weather/gov"),
      {},
    );

    expect(response).toBeNull();
  });

  test("responds to CORS preflight", async () => {
    const response = await handleEmailRequest(
      new Request("https://example.test/api/email/send", {
        method: "OPTIONS",
      }),
      {},
    );

    expect(response?.status).toBe(204);
    expect(response?.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
  });

  test("requires an API key secret", async () => {
    const response = await handleEmailRequest(
      new Request("https://example.test/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "recipient@example.com",
          subject: "Weather update",
          text: "Clear skies.",
        }),
      }),
      {},
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      title: "Email API Key Unavailable",
    });
  });

  test("rejects invalid bearer tokens", async () => {
    const response = await handleEmailRequest(
      new Request("https://example.test/api/email/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "recipient@example.com",
          subject: "Weather update",
          text: "Clear skies.",
        }),
      }),
      {
        EMAIL_API_KEY: "secret",
      },
    );

    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toBe('Bearer realm="email"');
  });

  test("validates request JSON", async () => {
    const response = await handleEmailRequest(
      new Request("https://example.test/api/email/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "not-an-email",
          subject: "",
        }),
      }),
      {
        EMAIL: {
          send: vi.fn(),
        },
        EMAIL_API_KEY: "secret",
        EMAIL_FROM: "weather@rmcd.cc",
      },
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      title: "Invalid Email Request",
    });
  });

  test("sends email through the Cloudflare binding", async () => {
    const send = vi.fn(async () => ({ messageId: "email-1" }));

    const response = await handleEmailRequest(
      new Request("https://example.test/api/email/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: ["recipient@example.com"],
          subject: "Weather update",
          text: "Clear skies.",
          html: "<p>Clear skies.</p>",
          replyTo: "support@rmcd.cc",
        }),
      }),
      {
        EMAIL: {
          send,
        },
        EMAIL_API_KEY: "secret",
        EMAIL_FROM: "weather@rmcd.cc",
      },
    );

    expect(response?.status).toBe(202);
    await expect(response?.json()).resolves.toEqual({
      messageId: "email-1",
    });
    expect(send).toHaveBeenCalledWith({
      from: "weather@rmcd.cc",
      to: ["recipient@example.com"],
      subject: "Weather update",
      text: "Clear skies.",
      html: "<p>Clear skies.</p>",
      replyTo: "support@rmcd.cc",
    });
  });

  test("worker fetch mounts the email route", async () => {
    const send = vi.fn(async () => ({ messageId: "email-1" }));

    const response = await worker.fetch(
      new Request("https://example.test/api/email/send", {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "recipient@example.com",
          subject: "Weather update",
          text: "Clear skies.",
        }),
      }),
      {
        EMAIL: {
          send,
        },
        EMAIL_API_KEY: "secret",
        EMAIL_FROM: "weather@rmcd.cc",
      },
    );

    expect(response.status).toBe(202);
    expect(send).toHaveBeenCalledOnce();
  });
});
