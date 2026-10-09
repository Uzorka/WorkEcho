import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { routeDecision } from "@/lib/routes";

// Refreshes the Supabase auth session cookie on each request, then applies
// route protection (see src/lib/routes.ts).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let onboarded = false;
  if (user) {
    // RLS: this only ever returns the user's own row.
    const { data } = await supabase.from("profiles").select("onboarded_at").maybeSingle();
    onboarded = Boolean(data?.onboarded_at);
  }

  const { pathname, search } = request.nextUrl;
  const target = routeDecision({ pathname, search, signedIn: Boolean(user), onboarded });
  if (!target) return response;

  const url = request.nextUrl.clone();
  const [path, query = ""] = target.split("?");
  url.pathname = path;
  url.search = query ? `?${query}` : "";
  const redirect = NextResponse.redirect(url);
  // Keep any refreshed session cookies.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}
