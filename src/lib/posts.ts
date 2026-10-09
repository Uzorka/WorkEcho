// Feed helpers shared by server and client (no zod, no server-only imports).

export const POST_CATEGORIES = {
  workplace_culture: "Workplace Culture",
  salary_benefits: "Salary & Benefits",
  career_advice: "Career Advice",
  management: "Management",
  work_life_balance: "Work-Life Balance",
  interview_experiences: "Interview Experiences",
  job_offers: "Job Offers",
  general: "General",
} as const;
export type PostCategory = keyof typeof POST_CATEGORIES;

export const POST_MAX = 1000;
export const REPLY_MAX = 500;
export const FEED_PAGE_SIZE = 10;
/** Posts longer than this get a "Show more" toggle in the feed. */
export const POST_PREVIEW_CHARS = 280;

export const FEED_SORTS = { latest: "Latest", top: "Top this week" } as const;
export type FeedSort = keyof typeof FEED_SORTS;

export type PublicPost = {
  id: string;
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
  category: PostCategory;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_pseudonym: string;
  like_count: number;
  reply_count: number;
  is_mine: boolean;
  liked_by_me: boolean;
};

export type PublicReply = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_pseudonym: string;
  is_mine: boolean;
};

// ---------------------------------------------------------------- avatar

/** "QuietFalcon82" -> "QF"; "Deleted user" -> "?" */
export function avatarInitials(pseudonym: string): string {
  if (pseudonym === "Deleted user") return "?";
  const caps = pseudonym.match(/[A-Z]/g) ?? [];
  return (caps.slice(0, 2).join("") || pseudonym.slice(0, 2)).toUpperCase();
}

// Dark enough for white text (WCAG AA) in both themes.
const AVATAR_COLOURS = ["#465D93", "#7A3E9D", "#1F7A5C", "#B2462E", "#2E6F95", "#8A5A00", "#A23B72", "#3F6B2A"];

export function avatarColour(pseudonym: string): string {
  if (pseudonym === "Deleted user") return "#6B7280";
  let h = 0;
  for (const ch of pseudonym) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

// ---------------------------------------------------------------- time

export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

// ---------------------------------------------------------------- contact details

/**
 * Phone numbers and email addresses aren't allowed in posts (privacy and
 * content rules). Catches common Nigerian formats, with or without spaces.
 */
export function containsContactDetails(text: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return true;
  const digitsOnly = text.replace(/(?<=\d)[\s.-]+(?=\d)/g, "");
  return /(?:\+?234|\b0)[789][01]\d{8}\b/.test(digitsOnly);
}
