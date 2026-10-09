import Link from "next/link";

// Shown to banned users where they would normally write.
export function BannedNotice() {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="font-semibold">Your account is suspended.</p>
      <p className="mt-1">
        You can still read everything, but you can&apos;t post, reply, review or report. This happens when content breaks our{" "}
        <Link href="/guidelines" className="font-medium underline">
          community guidelines
        </Link>
        .
      </p>
    </div>
  );
}
