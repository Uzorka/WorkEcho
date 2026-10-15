import type { Metadata, Viewport } from "next";
import { BottomNav, MobileHeader, Sidebar } from "@/components/AppNav";
import { getUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getUnreadCount } from "@/lib/feed-data";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const DESCRIPTION =
  "Learn what a Nigerian company is really like — pay, interviews and culture — from people who worked there.";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
    title: {
      default: "WorkEcho — honest reviews of Nigerian workplaces",
      template: "%s — WorkEcho",
    },
    description: DESCRIPTION,
    applicationName: "WorkEcho",
    openGraph: { type: "website", siteName: "WorkEcho", locale: "en_NG", description: DESCRIPTION },
    twitter: { card: "summary" },
    // Keep phone numbers in text from turning into tap-to-call links.
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F9FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1320" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Unread alerts for the nav badge (0 when logged out).
  const unread = (await getUser()) ? await getUnreadCount() : 0;
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh">
          <Sidebar unread={unread} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileHeader />
            <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
              {children}
            </main>
          </div>
        </div>
        <BottomNav unread={unread} />
      </body>
    </html>
  );
}
