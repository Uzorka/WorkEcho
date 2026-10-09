import { avatarColour, avatarInitials } from "@/lib/posts";

// Generated avatar: coloured circle with initials. No uploads, ever.
export function Avatar({ pseudonym, size = 40 }: { pseudonym: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: avatarColour(pseudonym), fontSize: size * 0.38 }}
    >
      {avatarInitials(pseudonym)}
    </span>
  );
}
