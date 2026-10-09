import { z } from "zod";
import {
  DEPARTMENTS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  INDUSTRIES,
  PROBATION_OUTCOMES,
  REVIEW_LIMITS,
  YES_NO_SOMETIMES,
} from "./companies";
import { NIGERIAN_STATES } from "./nigeria";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const rating = z.coerce
  .number({ message: "Choose a rating from 1 to 5." })
  .int()
  .min(1, { message: "Choose a rating from 1 to 5." })
  .max(5, { message: "Choose a rating from 1 to 5." });
const answer = z.preprocess(blankToNull, z.enum(keys(YES_NO_SOMETIMES)).nullable());

const text = (label: string, { min, max }: { min: number; max: number }) =>
  z
    .string()
    .trim()
    .min(min, { message: `${label} needs at least ${min} characters.` })
    .max(max, { message: `${label} can be at most ${max} characters.` });

export const reviewSchema = z.object({
  employment_status: z.enum(keys(EMPLOYMENT_STATUSES), { message: "Are you a current or former employee?" }),
  department: z.preprocess(blankToNull, z.enum(keys(DEPARTMENTS)).nullable()),
  employment_type: z.enum(keys(EMPLOYMENT_TYPES), { message: "Choose your employment type." }),
  state: z.preprocess(blankToNull, z.enum(NIGERIAN_STATES).nullable()),
  rating_overall: rating,
  rating_pay: rating,
  rating_work_life: rating,
  rating_management: rating,
  rating_culture: rating,
  rating_growth: rating,
  salary_on_time: answer,
  overtime_paid: answer,
  has_hmo: answer,
  pension_remitted: answer,
  got_contract: answer,
  probation_months: z.preprocess(blankToNull, z.coerce.number().int().min(0).max(12).nullable()),
  confirmed_after_probation: z.preprocess(blankToNull, z.enum(keys(PROBATION_OUTCOMES)).nullable()),
  headline: text("The headline", REVIEW_LIMITS.headline),
  pros: text("Pros", REVIEW_LIMITS.pros),
  cons: text("Cons", REVIEW_LIMITS.cons),
  advice_to_management: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .max(REVIEW_LIMITS.advice.max, { message: `Advice can be at most ${REVIEW_LIMITS.advice.max} characters.` })
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  ),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const companyRequestSchema = z.object({
  name: z.string().trim().min(2, { message: "Enter the company name." }).max(120, { message: "That name is too long." }),
  industry: z.enum(INDUSTRIES, { message: "Choose an industry." }),
  state: z.preprocess(blankToNull, z.enum(NIGERIAN_STATES, { message: "Choose a state from the list." }).nullable()),
  website: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`) : null),
    z.url({ message: "Enter a valid website, e.g. example.com." }).max(200).nullable(),
  ),
});
