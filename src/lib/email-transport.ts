import nodemailer, { type Transporter } from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export class EmailDeliveryError extends Error {
  readonly code: string;
  readonly responseCode?: number;

  constructor(code: string, responseCode?: number) {
    super(code);
    this.name = "EmailDeliveryError";
    this.code = code;
    this.responseCode = responseCode;
  }
}

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    throw new EmailDeliveryError("SMTP_NOT_CONFIGURED");
  }
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return {
    host,
    port,
    secure,
    requireTLS: process.env.NODE_ENV === "production" && !secure,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

let smtpTransport: Transporter | undefined;

function smtpFailure(error: unknown): EmailDeliveryError {
  const value = error && typeof error === "object"
    ? error as { code?: unknown; responseCode?: unknown }
    : {};
  const code = value.code === "ETIMEDOUT"
    ? "SMTP_TIMEOUT"
    : value.code === "EAUTH"
      ? "SMTP_AUTH_FAILED"
      : "SMTP_DELIVERY_FAILED";
  const responseCode = typeof value.responseCode === "number" && Number.isInteger(value.responseCode)
    ? value.responseCode
    : undefined;
  return new EmailDeliveryError(code, responseCode);
}

export function isEmailDeliveryConfigured(): boolean {
  if (!process.env.SMTP_FROM?.trim()) return false;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  try {
    smtpConfig();
    return true;
  } catch {
    return false;
  }
}

async function sendWithResend(message: EmailMessage, from: string, apiKey: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
    throw new EmailDeliveryError(name === "AbortError" || name === "TimeoutError" ? "RESEND_TIMEOUT" : "RESEND_NETWORK_ERROR");
  }
  if (!response.ok) throw new EmailDeliveryError("RESEND_REQUEST_REJECTED", response.status);
}

export async function sendEmailMessage(message: EmailMessage): Promise<void> {
  const from = process.env.SMTP_FROM?.trim();
  if (!from) throw new EmailDeliveryError("EMAIL_SENDER_NOT_CONFIGURED");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    await sendWithResend(message, from, apiKey);
    return;
  }

  const config = smtpConfig();
  smtpTransport ??= nodemailer.createTransport(config);
  try {
    await smtpTransport.sendMail({ ...message, from });
  } catch (error) {
    throw smtpFailure(error);
  }
}
