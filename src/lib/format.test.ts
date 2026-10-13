// Display formatting: money, counts, and the two date shapes the page shows.
// Every expected value is a literal, because a formatting change is a
// consumer-visible change to every figure on the page.

import { describe, expect, it } from "vitest";

import { ageText, money, pad2, reqText, whenLabel } from "./format";

describe("money", () => {
  it("prints a figure, an absence, and an unlimited allowance distinctly", () => {
    expect(money(15)).toBe("$15");
    expect(money(null)).toBe("-");
    expect(money(undefined)).toBe("-");
    expect(money(-1)).toBe("unlimited");
  });

  it("keeps four decimals below a dollar and two above", () => {
    expect(money(0.435)).toBe("$0.435");
    expect(money(0.1)).toBe("$0.1");
    expect(money(80)).toBe("$80");
  });
});

describe("reqText", () => {
  it("groups a count and marks an unlimited one", () => {
    expect(reqText(1234)).toBe("1,234");
    expect(reqText(-1)).toBe("unlimited");
    expect(reqText(null)).toBe("-");
  });
});

describe("ageText", () => {
  const at = "2026-10-13T12:00:00.000Z";

  it("moves from minutes to hours to days at the stated boundaries", () => {
    expect(ageText(at, Date.parse("2026-10-13T12:30:00Z")).text).toBe("less than an hour ago");
    expect(ageText(at, Date.parse("2026-10-13T13:30:00Z")).text).toBe("an hour ago");
    expect(ageText(at, Date.parse("2026-10-13T18:00:00Z")).text).toBe("6 hours ago");
    expect(ageText(at, Date.parse("2026-10-14T12:00:00Z")).text).toBe("24 hours ago");
    expect(ageText(at, Date.parse("2026-10-15T13:00:00Z")).text).toBe("2 days ago");
  });

  it("reports the age in hours so a caller can warn on its own threshold", () => {
    expect(ageText(at, Date.parse("2026-10-13T18:00:00Z")).hours).toBe(6);
  });

  it("never reports a negative age for a figure read in the future", () => {
    expect(ageText(at, Date.parse("2026-10-13T11:00:00Z")).hours).toBe(0);
  });
});

describe("whenLabel", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("names today and yesterday and falls back to a date", () => {
    expect(whenLabel("2026-10-14T09:30:00Z", now)).toBe("Today, 09:30 UTC");
    expect(whenLabel("2026-10-13T21:05:00Z", now)).toBe("Yesterday, 21:05 UTC");
    expect(whenLabel("2026-10-11T08:00:00Z", now)).toBe("Sun 11, 08:00 UTC");
    // The year is written only when it is not the reader's own.
    expect(whenLabel("2025-01-05T08:00:00Z", now)).toBe("5 Jan 2025, 08:00 UTC");
  });

  it("answers an empty string for a date that is not a date", () => {
    expect(whenLabel("not a date", now)).toBe("");
  });
});

describe("pad2", () => {
  it("pads a single digit and leaves two digits alone", () => {
    expect(pad2(7)).toBe("07");
    expect(pad2(23)).toBe("23");
  });
});
