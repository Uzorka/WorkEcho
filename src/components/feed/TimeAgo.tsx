import { timeAgo } from "@/lib/posts";

// Relative time ("5m", "2d"). The full date is in the tooltip and dateTime.
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("en-NG")} suppressHydrationWarning>
      {timeAgo(iso)}
    </time>
  );
}
