import type { Metadata } from "next";
import { TimeAgo } from "@/components/feed/TimeAgo";
import { SubmitButton } from "@/components/forms";
import { secondaryButtonClass } from "@/components/styles";
import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/feed-data";
import { markAllRead, openNotification } from "./actions";

export const metadata: Metadata = { title: "Alerts" };

const TEXT: Record<string, string> = {
  reply_to_your_post: "Someone replied to your post",
  moderation_warning: "A moderator sent you a warning",
};

export default async function AlertsPage() {
  await requireUser("/alerts");
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Alerts</h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <SubmitButton className={secondaryButtonClass} pendingText="Marking…">
              Mark all as read
            </SubmitButton>
          </form>
        )}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {unread > 0 ? `${unread} unread` : "You're all caught up."}
      </p>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">No alerts yet.</p>
          <p className="mt-1 text-sm text-muted">When someone replies to your post, you&apos;ll see it here. Messages from moderators show here too.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={openNotification.bind(null, n.id, n.post_id)}>
                <button
                  type="submit"
                  className={`flex w-full flex-col gap-1 rounded-2xl border p-4 text-left hover:border-primary ${
                    n.is_read ? "border-border bg-card" : "border-primary/40 bg-primary-soft"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {!n.is_read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                    {TEXT[n.type] ?? "New activity on your post"}
                    {!n.is_read && <span className="sr-only">(unread)</span>}
                  </span>
                  {n.type === "moderation_warning" && n.message && <span className="text-sm">{n.message}</span>}
                  {n.type === "moderation_warning" && (
                    <span className="text-xs text-muted">Please read the community guidelines. Repeated problems can lead to a ban.</span>
                  )}
                  {n.excerpt && <span className="line-clamp-2 text-sm text-muted">“{n.excerpt}”</span>}
                  <span className="text-xs text-muted">
                    <TimeAgo iso={n.created_at} />
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
