"use client";

import { useEffect } from "react";
import { reviewDraftKey } from "@/lib/review-draft";

// After a successful submit, forget the draft saved on this device.
export function ClearReviewDraft({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(reviewDraftKey(slug));
    } catch {}
  }, [slug]);
  return null;
}
