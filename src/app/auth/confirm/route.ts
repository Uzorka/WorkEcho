import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth-schemas";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

// Landing page for links in confirmation and password-reset emails.
// Supports token_hash links (our email templates, work across devices) and
// PKCE ?code= links (Supabase's default templates).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"), "/onboarding");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (ok) {
    const [path, query = ""] = next.split("?");
    url.pathname = path;
    url.search = query ? `?${query}` : "";
  } else {
    url.pathname = "/login";
    url.searchParams.set("notice", "link-invalid");
  }
  return NextResponse.redirect(url);
}
