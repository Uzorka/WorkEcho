// Plain constants shared by forms (client) and validation (server).
// Kept free of zod so client bundles stay small.

export const MIN_PASSWORD_LENGTH = 8;

export const USER_TYPES = ["current_employee", "former_employee", "job_seeker"] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  current_employee: "Current employee",
  former_employee: "Former employee",
  job_seeker: "Job seeker",
};
