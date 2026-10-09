"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { domainMatches, emailDomain, generateCode, isFreeEmailDomain, maskEmail } from "@/lib/verification";

// The work email lives only inside sendVerificationCode: it is checked, used
// once to send the code, and dropped. It is never stored, returned or logged.

export type VerifyState =
  | { step: "email"; errors?: Record<string, string>; message?: string; companyId?: string }
  | { step: "code"; companyName: string; masked: string; errors?: Record<string, string>; message?: string };

const sendSchema = z.object({
  company_id: z.uuid({ message: "Choose your company." }),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Enter your work email address." })),
  consent: z.literal("on", { message: "Please tick the box to continue." }),
});

const SEND_ERRORS: Record<string, string> = {
  not_allowed: "You can't verify right now.",
  free_domain: "Use your work email, not a free email address like Gmail or Yahoo.",
  wrong_domain: "That email doesn't match this company's work email domains.",
  revoked: "Your checkmark for this company was removed by our moderators, so you can't verify with it again.",
  already_verified: "You're already verified at this company. You can renew 30 days before it expires.",
  too_many: "You've used your 3 verification attempts for today. Please try again tomorrow.",
};

export async function sendVerificationCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const user = await requireUser("/me/verify");
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  const companyId = String(formData.get("company_id") ?? "");
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { step: "email", errors, companyId };
  }
  const { email } = parsed.data;
  const domain = emailDomain(email);

  if (isFreeEmailDomain(domain)) return { step: "email", errors: { email: SEND_ERRORS.free_domain }, companyId };

  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("id, name, email_domains").eq("id", parsed.data.company_id).maybeSingle();
  if (!company || !company.email_domains?.length) return { step: "email", errors: { company_id: "This company can't be verified by email yet." }, companyId };
  if (!domainMatches(domain, company.email_domains as string[]))
    return {
      step: "email",
      errors: { email: `Use your ${company.name} work email (ending in ${(company.email_domains as string[]).map((d) => `@${d}`).join(" or ")}).` },
      companyId,
    };
  if (!isEmailConfigured()) return { step: "email", message: "Email verification isn't switched on yet. Please try again later.", companyId };

  const code = generateCode();
  // Server-only call (service role): users can't create codes for themselves.
  const { data: status, error } = await createAdminClient().rpc("create_verification_challenge", {
    p_user_id: user.id,
    p_company_id: company.id,
    p_email_domain: domain,
    p_code: code,
  });
  if (error) return { step: "email", message: "Something went wrong. Please try again.", companyId };
  if (status !== "sent") return { step: "email", message: SEND_ERRORS[status as string] ?? "Something went wrong. Please try again.", companyId };

  const sent = await sendEmail({
    to: email,
    subject: "Your verification code",
    text: `Your WorkEcho verification code is ${code}\n\nIt expires in 15 minutes. If you didn't ask for this, you can ignore this email.`,
  });
  if (!sent) return { step: "email", message: "We couldn't send the email. Please check the address and try again.", companyId };

  return { step: "code", companyName: company.name as string, masked: maskEmail(email) };
}

const CONFIRM_ERRORS: Record<string, string> = {
  expired: "That code has expired. Please ask for a new one.",
  too_many_attempts: "Too many wrong tries. Please ask for a new code.",
  revoked: "Your checkmark for this company was removed by our moderators.",
};

export async function confirmVerificationCode(prev: VerifyState, formData: FormData): Promise<VerifyState> {
  await requireUser("/me/verify");
  if (prev.step !== "code") return prev;
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ...prev, errors: { code: "Enter the 6-digit code from the email." }, message: undefined };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_company_verification", { p_code: code });
  if (error) return { ...prev, errors: undefined, message: "You can't verify right now." };
  const result = data as { status: string; attempts_left?: number };
  if (result.status === "verified") {
    revalidatePath("/", "layout");
    redirect("/me?notice=verified");
  }
  if (result.status === "wrong_code")
    return {
      ...prev,
      message: undefined,
      errors: { code: `That code isn't right. ${result.attempts_left} ${result.attempts_left === 1 ? "try" : "tries"} left.` },
    };
  return { ...prev, errors: undefined, message: CONFIRM_ERRORS[result.status] ?? "Something went wrong. Please try again." };
}
