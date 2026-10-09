"use client";

// Fallback when the root layout itself fails. Must render its own <html>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-NG">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, background: "#F8F9FF", color: "#171B26" }}>
        <h1>Something went wrong</h1>
        <p>Please try again.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 16px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
