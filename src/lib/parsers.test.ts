// The cell readers and the two vendor parsers, against small fixtures shaped
// like the real pages. The full vendor pages are the fixtures of
// scripts/verify.ts; these tests pin the rules the parsers depend on.

import { describe, expect, it } from "vitest";

import { count, money, normKey, parseGoMarkdown, parseGoatHtml, stripTags } from "./parsers";

describe("money", () => {
  it("reads a price, a free tier, and an unlimited one", () => {
    expect(money("$0.435")).toBe(0.435);
    expect(money("Free")).toBe(0);
    expect(money("Unlimited")).toBe(-1);
  });

  it("treats a dash, an em dash and an empty cell as no figure", () => {
    expect(money("-")).toBeNull();
    expect(money("\u2014")).toBeNull();
    expect(money("")).toBeNull();
  });

  it("takes the plan's own rate from a cell that also carries a promotion", () => {
    expect(money("$20 $60 through Oct 20th")).toBe(20);
  });
});

describe("count", () => {
  it("reads a request estimate with separators", () => {
    expect(count("1,234")).toBe(1234);
    expect(count("Unlimited")).toBe(-1);
    expect(count("")).toBeNull();
  });
});

describe("stripTags", () => {
  it("drops markup, keeps the words, and decodes the one entity that appears", () => {
    expect(stripTags("<b>Go</b> &amp; GOAT<br/>plan")).toBe("Go & GOAT plan");
  });
});

describe("normKey", () => {
  it("survives the vendor's own formatting", () => {
    expect(normKey("Tencent Hy4 Preview")).toBe("hy4");
    expect(normKey("MiMo V2.6 Flash")).toBe(normKey("MiMo 2.6 Flash"));
    expect(normKey("DeepSeek V4 Flash (Off-Peak)")).toBe(normKey("DeepSeek V4 Flash"));
  });

  it("keeps two models the vendors list separately apart", () => {
    expect(normKey("DeepSeek V4 Flash Vision")).not.toBe(normKey("DeepSeek V4 Flash Vision Exp"));
  });
});

describe("parseGoMarkdown", () => {
  const md = [
    "| Model | Input | Output | Cache read | Cache write | Monthly |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Alpha | $0.10 | $0.50 | $0.01 | $0.12 | $15 |",
    "| Beta | $0.20 | $1.00 | $0.02 | $0.25 | $20 |",
    "",
    "| Model | Requests per 5 hours | Requests per week | Requests per month |",
    "| --- | --- | --- | --- |",
    "| Alpha | 100 | 300 | 600 |",
    "",
    "| Model | Input | Output | Cache read | Cache write | Monthly |",
    "| --- | --- | --- | --- | --- |",
    "| Gamma | $5 | $25 | $0.50 | $6.25 | $70 |",
  ].join("\n");

  it("reads the tier's rows and stops at the next plan's table", () => {
    const rows = parseGoMarkdown(md);
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Beta"]);
  });

  it("attaches the vendor's own request estimates by model key", () => {
    const rows = parseGoMarkdown(md);
    expect(rows[0].req5h).toBe(100);
    expect(rows[0].reqMonth).toBe(600);
    expect(rows[1].req5h).toBeUndefined();
  });

  it("refuses to answer with nothing when the table is missing", () => {
    expect(() => parseGoMarkdown("no tables here")).toThrow(/pricing table not found/);
  });
});

describe("parseGoatHtml", () => {
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const html = [
    row(["Model", "Input", "Output", "Cache Read", "Cache Write", "Monthly credits"]),
    row(["Alpha", "$0.10", "$0.50", "$0.01", "$0.12", "$20 $60 through Oct 20th"]),
    row(["Alpha", "$9", "$9", "$9", "$9", "$90"]),
    row(["Model", "Caps"]),
    row(["Glyph ClusterFree", "256K", "not yet scored", "Free", "Free", "Free", "\u2014"]),
    row(["Model", "Requests / 5 hours", "Requests per week", "Requests per month"]),
    row(["Alpha", "1,000", "2,500", "5,000"]),
  ].join("");

  it("keeps the core table's row when a later table repeats the model", () => {
    const rows = parseGoatHtml(html);
    const alpha = rows.find((r) => r.name === "Alpha");
    expect(alpha?.input).toBe(0.1);
    expect(alpha?.monthly).toBe(20);
    expect(alpha?.promo).toBe("through Oct 20th");
  });

  it("keeps a free model as unlimited rather than dropping it", () => {
    const rows = parseGoatHtml(html);
    const free = rows.find((r) => r.name === "Glyph Cluster");
    expect(free?.monthly).toBe(-1);
    expect(free?.input).toBe(0);
  });

  it("attaches the request table by model key", () => {
    const rows = parseGoatHtml(html);
    expect(rows.find((r) => r.name === "Alpha")?.reqMonth).toBe(5000);
  });

  it("does not read a credits row as a free one", () => {
    const rows = parseGoatHtml(html);
    expect(rows.filter((r) => r.monthly === -1).map((r) => r.name)).toEqual(["Glyph Cluster"]);
  });
});
