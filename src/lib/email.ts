import "server-only";
import { sendEmailMessage } from "./email-transport";
export { isEmailDeliveryConfigured } from "./email-transport";

type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORDLESS_LOGIN";

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
  const purpose = purposeText(input.purpose);
  const name = escapeHtml(input.name || "there");
  await sendEmailMessage({
    to: input.to,
    subject: purpose.subject,
    text: `Hello ${input.name || "there"},\n\nUse ${input.code} to ${purpose.action}. This code expires in 5 minutes. If you did not request it, you can ignore this email.\n\nJeevan Sahay`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#16202e"><h2 style="color:#173b70">Jeevan Sahay</h2><p>Hello ${name},</p><p>Use this code to ${purpose.action}:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px;color:#173b70">${input.code}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}

export async function sendHospitalApplicationDecisionEmail(input: {
  to: string;
  name: string;
  hospitalName: string;
  decision: "VERIFIED" | "REJECTED";
  reason?: string;
}): Promise<void> {
  const approved = input.decision === "VERIFIED";
  const recipient = escapeHtml(input.name || "there");
  const hospital = escapeHtml(input.hospitalName);
  const reason = escapeHtml(input.reason || "No additional details were provided.");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
  const link = approved ? `${appUrl.replace(/\/$/, "")}/hospital` : `${appUrl.replace(/\/$/, "")}/login?reason=hospital-rejected`;
  const subject = approved ? "Hospital application approved — Jeevan Sahay" : "Hospital application decision — Jeevan Sahay";
  const text = approved
    ? `Hello ${input.name || "there"},\n\nYour application for ${input.hospitalName} has been approved. Sign in to the Hospital Portal: ${link}\n\nJeevan Sahay`
    : `Hello ${input.name || "there"},\n\nYour application for ${input.hospitalName} was not approved. Reason: ${input.reason || "No additional details were provided."}\n\nYou may contact support if you believe this decision needs review.\n\nJeevan Sahay`;
  const body = approved
    ? `<p>Your application for <strong>${hospital}</strong> has been approved.</p><p><a href="${escapeHtml(link)}">Open the Hospital Portal</a></p>`
    : `<p>Your application for <strong>${hospital}</strong> was not approved.</p><p><strong>Reason:</strong> ${reason}</p><p>You may contact support if you believe this decision needs review.</p>`;
  await sendEmailMessage({
    to: input.to,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16202e"><h2 style="color:#173b70">Jeevan Sahay</h2><p>Hello ${recipient},</p>${body}</div>`,
  });
}

export async function sendPortalNoticeEmail(input: {
  to: string;
  name?: string;
  subject: string;
  paragraphs: string[];
  actionPath?: string;
  actionLabel?: string;
}): Promise<void> {
  const name = input.name?.trim() || "there";
  const subject = input.subject.replace(/[\r\n]+/g, " ").slice(0, 180);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  let actionUrl: string | undefined;
  if (baseUrl && input.actionPath?.startsWith("/")) {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        actionUrl = new URL(input.actionPath, parsed).toString();
      }
    } catch {
      actionUrl = undefined;
    }
  }
  const text = [
    `Hello ${name},`,
    "",
    ...input.paragraphs,
    ...(actionUrl && input.actionLabel ? ["", `${input.actionLabel}: ${actionUrl}`] : []),
    "",
    "Jeevan Sahay",
  ].join("\n");
  const paragraphs = input.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const action = actionUrl && input.actionLabel
    ? `<p><a href="${escapeHtml(actionUrl)}">${escapeHtml(input.actionLabel)}</a></p>`
    : "";
  await sendEmailMessage({
    to: input.to,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16202e"><h2 style="color:#173b70">Jeevan Sahay</h2><p>Hello ${escapeHtml(name)},</p>${paragraphs}${action}</div>`,
  });
}
