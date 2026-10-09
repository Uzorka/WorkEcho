import { z } from "zod";
import {
  BENEFITS,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  INTERVIEW_EXPERIENCES,
  INTERVIEW_LIMITS,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  SALARY_LEVELS,
  SALARY_MAX_NAIRA,
  SALARY_MIN_NAIRA,
  formatNaira,
  parseNaira,
} from "./companies";
import { NIGERIAN_STATES } from "./nigeria";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/** FormData -> plain object, keeping repeated fields (checkboxes) as arrays. */
export function formDataToObject(formData: FormData, arrayFields: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    out[key] = arrayFields.includes(key) ? formData.getAll(key) : formData.get(key);
  }
  for (const f of arrayFields) out[f] ??= [];
  return out;
}

export const salarySchema = z
  .object({
    role_group: z.enum(keys(DEPARTMENTS), { message: "Choose the area you work in." }),
    level: z.enum(keys(SALARY_LEVELS), { message: "Choose your level." }),
    employment_type: z.enum(keys(EMPLOYMENT_TYPES), { message: "Choose your employment type." }),
    state: z.preprocess(blankToNull, z.enum(NIGERIAN_STATES, { message: "Choose a state from the list." }).nullable()),
    monthly_gross_naira: z.preprocess(
      (v) => (v === "" || v == null ? undefined : (parseNaira(v) ?? Number.NaN)),
      z
        .number({ message: "Enter your monthly gross pay in Naira, e.g. 250,000." })
        .int({ message: "Enter a whole number of Naira." })
        .min(SALARY_MIN_NAIRA, {
          message: `That looks too low for monthly pay. Enter your monthly gross pay in Naira (at least ${formatNaira(SALARY_MIN_NAIRA)}).`,
        })
        .max(SALARY_MAX_NAIRA, {
          message: "That looks too high for monthly pay. Check the zeros, and enter monthly (not yearly) pay.",
        }),
    ),
    has_bonus: z.enum(["yes", "no"], { message: "Do you get a bonus?" }).transform((v) => v === "yes"),
    other_benefits: z.array(z.enum([...keys(BENEFITS), "none"], { message: "Choose from the list." })).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.other_benefits.includes("none") && v.other_benefits.length > 1)
      ctx.addIssue({ code: "custom", path: ["other_benefits"], message: "You ticked “None” and a benefit. Pick one or the other." });
  })
  .transform((v) => ({ ...v, other_benefits: v.other_benefits.filter((b) => b !== "none") }));
export type SalaryInput = z.infer<typeof salarySchema>;

const L = INTERVIEW_LIMITS;
export const interviewSchema = z.object({
  role_group: z.enum(keys(DEPARTMENTS), { message: "Choose the area of the role." }),
  outcome: z.enum(keys(INTERVIEW_OUTCOMES), { message: "How did it end?" }),
  difficulty: z.coerce
    .number({ message: "Rate the difficulty from 1 to 5." })
    .int()
    .min(1, { message: "Rate the difficulty from 1 to 5." })
    .max(5, { message: "Rate the difficulty from 1 to 5." }),
  process_weeks: z.preprocess(
    blankToNull,
    z.coerce
      .number({ message: "Enter a number of weeks." })
      .int({ message: "Enter a whole number of weeks." })
      .min(0, { message: "Weeks can't be negative." })
      .max(L.weeks.max, { message: `Enter ${L.weeks.max} weeks or fewer.` })
      .nullable(),
  ),
  stages: z.array(z.enum(keys(INTERVIEW_STAGES), { message: "Choose from the list." })).default([]),
  questions_asked: z
    .string()
    .trim()
    .min(L.questions.min, { message: `Tell us a bit more (at least ${L.questions.min} characters).` })
    .max(L.questions.max, { message: `Keep it under ${L.questions.max} characters.` }),
  tips: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(L.tips.max, { message: `Keep tips under ${L.tips.max} characters.` }).nullable().optional().transform((v) => v ?? null),
  ),
  experience: z.enum(keys(INTERVIEW_EXPERIENCES), { message: "How was the experience overall?" }),
});
export type InterviewInput = z.infer<typeof interviewSchema>;
