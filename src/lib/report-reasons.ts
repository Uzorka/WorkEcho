export const REPORT_REASONS = {
  personal_info: "Shares personal information",
  fake_misleading: "Fake or misleading",
  harassment_threat: "Harassment or a threat",
  names_individual: "Names an individual",
  spam: "Spam",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_CONTENT_TYPES = ["post", "reply", "review", "interview", "salary_group"] as const;
export type ReportContentType = (typeof REPORT_CONTENT_TYPES)[number];

export function isReportReason(r: string): r is ReportReason {
  return r in REPORT_REASONS;
}
