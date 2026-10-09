import "server-only";
import { serverEnv } from "./env.server";

// Sends plain-text emails. Production: Resend's HTTP API. Local dev: Mailpit.
// Never log the recipient or the body (they contain a work email and a code).

const SENDER_NAME = "WorkEcho";

export function isEmailConfigured() {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY || env.MAILPIT_URL);
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<boolean> {
  const env = serverEnv();
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${SENDER_NAME} <${env.EMAIL_FROM_ADDRESS ?? "onboarding@resend.dev"}>`,
          to: [to],
          subject,
          text,
        }),
      });
      return res.ok;
    }
    if (env.MAILPIT_URL) {
      const res = await fetch(`${env.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: env.EMAIL_FROM_ADDRESS ?? "no-reply@workecho.test", Name: SENDER_NAME },
          To: [{ Email: to }],
          Subject: subject,
          Text: text,
        }),
      });
      return res.ok;
    }
  } catch {
    // Deliberately not logged: the error could include the recipient.
  }
  return false;
}
