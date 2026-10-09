import { describe, expect, it } from "vitest";
import { detectSensitive, hasBlockedContactDetails } from "@/lib/sensitive";

const kinds = (t: string) => detectSensitive(t).map((m) => [m.kind, m.text]);

describe("detectSensitive", () => {
  it("finds emails", () => {
    expect(kinds("write to ada.obi@example.com please")).toEqual([["email", "ada.obi@example.com"]]);
  });

  it("finds Nigerian phone numbers: +234 or 0 followed by 10 digits, with or without spaces", () => {
    for (const phone of ["08031234567", "0803 123 4567", "0803-123-4567", "+2348031234567", "+234 803 123 4567", "2348031234567", "07012345678"])
      expect(kinds(`call ${phone} now`)).toEqual([["phone", phone]]);
  });

  it("finds staff-ID-like codes", () => {
    expect(kinds("my staff ID: HB10234 was on the letter")[0]).toEqual(["staff_id", "staff ID: HB10234"]);
    expect(kinds("ref ZB/2019/0456 from HR")).toEqual([["staff_id", "ZB/2019/0456"]]);
    expect(kinds("badge EMP-10234")).toEqual([["staff_id", "EMP-10234"]]);
  });

  it("finds long digit strings like account numbers and BVN", () => {
    expect(kinds("account 0123456789 at the bank")).toEqual([["long_number", "0123456789"]]);
    expect(kinds("BVN 22212345678")).toEqual([["long_number", "22212345678"]]);
  });

  it("returns positions so the UI can highlight", () => {
    const [m] = detectSensitive("hi ada@example.com");
    expect([m.start, m.end]).toEqual([3, 18]);
  });

  it("leaves ordinary text alone: money, years, short numbers", () => {
    for (const t of ["₦250,000 a month", "₦2500000 a month", "N2500000", "I worked there 3 years", "Q3 2026", "9am to 5pm", "rated 4.5 out of 5", "1,200,000"])
      expect(kinds(t)).toEqual([]);
  });

  it("doesn't double-count a phone number as a long number", () => {
    expect(detectSensitive("08031234567")).toHaveLength(1);
  });
});

describe("hasBlockedContactDetails", () => {
  it("blocks emails and phones only", () => {
    expect(hasBlockedContactDetails("ada@example.com")).toBe(true);
    expect(hasBlockedContactDetails("0803 123 4567")).toBe(true);
    expect(hasBlockedContactDetails("account 0123456789")).toBe(false);
    expect(hasBlockedContactDetails("staff ID HB10234")).toBe(false);
    expect(hasBlockedContactDetails(null)).toBe(false);
  });
});
