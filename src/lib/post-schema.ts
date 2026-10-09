import { z } from "zod";
import { POST_CATEGORIES, POST_MAX, REPLY_MAX, containsContactDetails } from "./posts";

const CONTACT = "Please remove phone numbers and email addresses. They can identify you or others.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const body = (max: number, what: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `Write something before you ${what}.` })
    .max(max, { message: `Keep it to ${max.toLocaleString("en-NG")} characters or fewer.` })
    .refine((v) => !containsContactDetails(v), { message: CONTACT });

export const postSchema = z.object({
  category: z.enum(Object.keys(POST_CATEGORIES) as [keyof typeof POST_CATEGORIES], { message: "Choose a category." }),
  company_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(UUID, { message: "Choose a company from the list." }).nullable()),
  body: body(POST_MAX, "post"),
});

export const postEditSchema = postSchema.pick({ category: true, body: true });

export const replySchema = z.object({ body: body(REPLY_MAX, "reply") });

export const uuidSchema = z.string().regex(UUID);
