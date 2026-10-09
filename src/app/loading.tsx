export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-border" />
      <div className="h-4 w-full animate-pulse rounded bg-border" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-border" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-border" />
    </div>
  );
}
