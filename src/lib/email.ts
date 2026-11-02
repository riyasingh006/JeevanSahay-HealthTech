import "server-only";
import nodemailer from "nodemailer";

type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORDLESS_LOGIN";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
  }
  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

export function isEmailDeliveryConfigured(): boolean {
  try {
    smtpConfig();
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function purposeText(purpose: OtpPurpose): { subject: string; action: string } {
  if (purpose === "EMAIL_VERIFICATION") {
    return { subject: "Verify your Jeevan Sahay email", action: "verify your email address" };
  }
  if (purpose === "PASSWORD_RESET") {
    return { subject: "Reset your Jeevan Sahay password", action: "reset your password" };
  }
  return { subject: "Your Jeevan Sahay sign-in code", action: "sign in to your account" };
}

export async function sendAuthOtpEmail(input: {
  to: string;
  name: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const config = smtpConfig();
  const purpose = purposeText(input.purpose);
  const name = escapeHtml(input.name || "there");
  await nodemailer.createTransport(config).sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: purpose.subject,
    text: `Hello ${input.name || "there"},\n\nUse ${input.code} to ${purpose.action}. This code expires in 5 minutes. If you did not request it, you can ignore this email.\n\nJeevan Sahay`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#16202e"><h2 style="color:#173b70">Jeevan Sahay</h2><p>Hello ${name},</p><p>Use this code to ${purpose.action}:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px;color:#173b70">${input.code}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}
