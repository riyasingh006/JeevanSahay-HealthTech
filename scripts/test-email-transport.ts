import assert from "node:assert/strict";
import { isEmailDeliveryConfigured, sendEmailMessage } from "../src/lib/email-transport";

const envKeys = ["RESEND_API_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SECURE"] as const;
const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const apiKey = "test-resend-key-not-a-credential";
const otp = "731204";

function restoreEnvironment() {
  for (const key of envKeys) {
    const previous = previousEnv.get(key);
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
  globalThis.fetch = originalFetch;
}

async function main() {
  process.env.RESEND_API_KEY = apiKey;
  process.env.SMTP_FROM = "Jeevan Sahay <test@example.test>";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_SECURE;
  assert.equal(isEmailDeliveryConfigured(), true);

  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  let requestSignal: AbortSignal | null | undefined;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    requestSignal = init?.signal as AbortSignal | null | undefined;
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "email-test-id" }), { status: 200 });
  }) as typeof fetch;

  await sendEmailMessage({
    to: "recipient@example.test",
    subject: "Verify your account",
    text: `Your test code is ${otp}`,
    html: `<p>Your test code is ${otp}</p>`,
  });
  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.equal(requestHeaders?.get("authorization"), `Bearer ${apiKey}`);
  assert.equal(requestHeaders?.get("content-type"), "application/json");
  assert.ok(requestSignal instanceof AbortSignal);
  assert.deepEqual(requestBody, {
    from: "Jeevan Sahay <test@example.test>",
    to: ["recipient@example.test"],
    subject: "Verify your account",
    text: `Your test code is ${otp}`,
    html: `<p>Your test code is ${otp}</p>`,
  });

  globalThis.fetch = (async () => new Response(
    JSON.stringify({ message: `provider detail includes ${apiKey} and ${otp}` }),
    { status: 422 }
  )) as typeof fetch;
  await assert.rejects(
    sendEmailMessage({ to: "recipient@example.test", subject: "Test", text: "Test", html: "Test" }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "RESEND_REQUEST_REJECTED");
      assert.equal((error as { responseCode?: number }).responseCode, 422);
      assert.doesNotMatch((error as Error).message, /provider detail|test-resend-key|731204/);
      return true;
    }
  );

  globalThis.fetch = (async () => {
    throw Object.assign(new Error(`network detail ${apiKey} ${otp}`), { name: "TimeoutError" });
  }) as typeof fetch;
  await assert.rejects(
    sendEmailMessage({ to: "recipient@example.test", subject: "Test", text: "Test", html: "Test" }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "RESEND_TIMEOUT");
      assert.doesNotMatch((error as Error).message, /network detail|test-resend-key|731204/);
      return true;
    }
  );

  assert.equal(typeof requestSignal?.aborted, "boolean");

  delete process.env.RESEND_API_KEY;
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "2525";
  process.env.SMTP_USER = "test-user";
  process.env.SMTP_PASSWORD = "test-password";
  process.env.SMTP_FROM = "Jeevan Sahay <test@example.test>";
  process.env.SMTP_SECURE = "false";
  assert.equal(isEmailDeliveryConfigured(), true);
  delete process.env.SMTP_FROM;
  assert.equal(isEmailDeliveryConfigured(), false);

  console.log("PASS Resend HTTPS delivery request, provider failure sanitization, timeout handling, and SMTP configuration detection");
}

main().finally(restoreEnvironment).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Email transport test failed");
  process.exitCode = 1;
});
