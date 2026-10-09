import { BLOCKED_KINDS, SENSITIVE_LABELS, detectSensitive } from "@/lib/sensitive";

// Live warning under a text field: shows each risky bit highlighted in its
// surrounding text, so people can edit before posting. Pure component.
export function SensitiveWarning({ text, id }: { text: string; id?: string }) {
  const matches = detectSensitive(text);
  if (matches.length === 0) return null;
  const blocked = matches.some((m) => BLOCKED_KINDS.includes(m.kind));

  return (
    <div
      id={id}
      role="status"
      className={`flex flex-col gap-2 rounded-xl border p-3 text-sm ${blocked ? "border-danger/50 bg-danger/10" : "border-amber-500/50 bg-amber-500/10"}`}
    >
      <p className="font-semibold">
        {blocked ? "Remove phone numbers and email addresses before posting." : "This could identify you or someone else."}
      </p>
      <ul className="flex flex-col gap-1">
        {matches.map((m) => (
          <li key={`${m.start}-${m.kind}`}>
            <span className="text-muted">{SENSITIVE_LABELS[m.kind]}: </span>
            <span className="break-words">
              {m.start > 0 && "…"}
              {text.slice(Math.max(0, m.start - 25), m.start)}
              <mark className="rounded bg-amber-300 px-0.5 text-[#171B26]">{text.slice(m.start, m.end)}</mark>
              {text.slice(m.end, m.end + 25)}
              {m.end + 25 < text.length && "…"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">This check isn&apos;t perfect. Read your text again before you post.</p>
    </div>
  );
}
