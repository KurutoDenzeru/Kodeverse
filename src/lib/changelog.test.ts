// The changelog: what a change looks like, which snapshot a day keeps, how far
// back history survives, and the order entries come back in.

import { describe, expect, it } from "vitest";

import { buildLog, dayKey, diffSnapshots, pruneHistory, recordDay, snapshotOf } from "./changelog";
import type { PlanData, PlanSide } from "./types";

const side = (over: Partial<PlanSide> = {}): PlanSide => ({
  name: "Model",
  input: null,
  output: null,
  cacheRead: null,
  cacheWrite: null,
  monthly: null,
  five: null,
  week: null,
  ...over,
});

const dataWith = (monthly: number | null, at: string): PlanData => ({
  fetchedAt: at,
  sources: {},
  plans: [
    {
      id: "opencode",
      cls: "go",
      label: "OpenCode Go",
      short: "Go",
      price: 10,
      src: "",
      fmt: "md",
      note: "",
    },
    {
      id: "commandcode",
      cls: "goat",
      label: "Command Code GOAT",
      short: "GOAT",
      price: 10,
      src: "",
      fmt: "html",
      note: "",
    },
  ],
  caps: {},
  models: [
    {
      key: "a",
      name: "Alpha",
      plans: { opencode: side({ monthly }), commandcode: side({ monthly: 20 }) },
    },
  ],
});

const LABELS = { opencode: "OpenCode Go", commandcode: "Command Code GOAT" };

describe("diffSnapshots", () => {
  const before = snapshotOf(dataWith(15, "2026-10-11T10:00:00.000Z"));
  const after = snapshotOf(dataWith(20, "2026-10-12T10:00:00.000Z"));

  it("reports one entry that names the field, the plan, and both figures", () => {
    const diff = diffSnapshots(before, after, LABELS) ?? [];
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      kind: "allowance",
      model: "Alpha",
      plan: "OpenCode Go",
      label: "Monthly allowance",
      text: "$15 to $20",
      when: "2026-10-12T10:00:00.000Z",
    });
  });

  it("has nothing to report when nothing moved", () => {
    expect(diffSnapshots(before, before, LABELS)).toEqual([]);
  });

  it("has nothing to compare without a previous snapshot", () => {
    expect(diffSnapshots(null, after, LABELS)).toBeNull();
  });
});

describe("history", () => {
  it("keeps the first snapshot of a day and ignores a later one", () => {
    const first = snapshotOf(dataWith(15, "2026-10-12T08:00:00.000Z"));
    const second = snapshotOf(dataWith(20, "2026-10-12T20:00:00.000Z"));
    const h = recordDay({}, first);
    expect(h[dayKey(first.at)]).toBe(first);
    expect(recordDay(h, second)[dayKey(first.at)]).toBe(first);
  });

  it("drops days past the window and keys that are not dates", () => {
    const h = {
      "2026-01-01": snapshotOf(dataWith(1, "2026-01-01T00:00:00.000Z")),
      "2026-10-12": snapshotOf(dataWith(2, "2026-10-12T00:00:00.000Z")),
      "not-a-date": snapshotOf(dataWith(3, "2026-10-12T00:00:00.000Z")),
    };
    expect(pruneHistory(h, Date.parse("2026-10-13T00:00:00.000Z"))).toBe(true);
    expect(Object.keys(h)).toEqual(["2026-10-12"]);
  });
});

describe("buildLog", () => {
  const day1 = snapshotOf(dataWith(15, "2026-10-11T10:00:00.000Z"));
  const day2 = snapshotOf(dataWith(20, "2026-10-12T10:00:00.000Z"));
  const live = snapshotOf(dataWith(25, "2026-10-12T18:00:00.000Z"));
  const history = { "2026-10-11": day1, "2026-10-12": day2 };

  it("diffs the live figures against the most recent stored day", () => {
    const log = buildLog(history, live, LABELS);
    expect(log[0]).toMatchObject({ text: "$20 to $25", when: live.at });
  });

  it("then reports each stored day against the day before it", () => {
    const log = buildLog(history, live, LABELS);
    expect(log[1]).toMatchObject({ text: "$15 to $20", when: day2.at });
  });

  it("has no entries when there is no history at all", () => {
    expect(buildLog({}, live, LABELS)).toEqual([]);
  });
});
