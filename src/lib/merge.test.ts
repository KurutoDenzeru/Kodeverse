// The merge: cap rules per plan, one row per model key, and the guard that
// decides whether a refreshed table may replace the figures on screen.

import { describe, expect, it } from "vitest";

import { mergeModels, refreshAccepted } from "./merge";
import type { ModelRow, PlanCaps } from "./types";

const caps: Record<string, PlanCaps> = {
  opencode: { fiveHourPct: 0.2, weekPct: 0.5 },
  commandcode: { fiveHour: 14, week: 35 },
  silent: { published: false },
};

describe("caps", () => {
  it("applies a flat cap as the smaller of the allowance and the cap", () => {
    const [row] = mergeModels(
      [
        [
          "commandcode",
          [
            {
              name: "A",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 20,
            },
          ],
        ],
      ],
      caps,
    );
    expect(row.plans.commandcode?.five).toBe(14);
    expect(row.plans.commandcode?.week).toBe(20);
  });

  it("applies a derived cap as the model limit times the share", () => {
    const [row] = mergeModels(
      [
        [
          "opencode",
          [
            {
              name: "A",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 15,
            },
          ],
        ],
      ],
      caps,
    );
    expect(row.plans.opencode?.five).toBe(3);
    expect(row.plans.opencode?.week).toBe(7.5);
  });

  it("gives a plan that publishes no cap rule null rather than another plan's numbers", () => {
    const [row] = mergeModels(
      [
        [
          "silent",
          [
            {
              name: "A",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 20,
            },
          ],
        ],
      ],
      caps,
    );
    expect(row.plans.silent?.five).toBeNull();
    expect(row.plans.silent?.week).toBeNull();
  });

  it("keeps an unlimited allowance unlimited", () => {
    const [row] = mergeModels(
      [
        [
          "commandcode",
          [
            {
              name: "A",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: -1,
            },
          ],
        ],
      ],
      caps,
    );
    expect(row.plans.commandcode?.five).toBe(-1);
    expect(row.plans.commandcode?.week).toBe(-1);
  });
});

describe("merge", () => {
  it("keeps the cheapest tier listed for a key and drops the dearer one", () => {
    const rows = mergeModels(
      [
        [
          "opencode",
          [
            {
              name: "Alpha (Off-Peak)",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 15,
            },
            {
              name: "Alpha (latest)",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 60,
            },
          ],
        ],
      ],
      caps,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].plans.opencode?.monthly).toBe(15);
  });

  it("merges the two catalogues on the normalised key", () => {
    const rows = mergeModels(
      [
        [
          "opencode",
          [
            {
              name: "Tencent Hy4 Preview",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 15,
            },
          ],
        ],
        [
          "commandcode",
          [
            {
              name: "Hy4 preview",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 20,
            },
          ],
        ],
      ],
      caps,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].plans.opencode?.monthly).toBe(15);
    expect(rows[0].plans.commandcode?.monthly).toBe(20);
  });

  it("returns rows sorted by name", () => {
    const rows = mergeModels(
      [
        [
          "opencode",
          [
            {
              name: "Beta",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 1,
            },
            {
              name: "Alpha",
              input: null,
              output: null,
              cacheRead: null,
              cacheWrite: null,
              monthly: 1,
            },
          ],
        ],
      ],
      caps,
    );
    expect(rows.map((r) => r.name)).toEqual(["Alpha", "Beta"]);
  });
});

describe("refreshAccepted", () => {
  // A catalogue, not a fragment: the guard's first demand is that the table is
  // whole, so the fixture is the size of the real one.
  const catalogue = Array.from({ length: 45 }, (_, i) => ({
    key: "m" + i,
    name: "Model " + i,
    plans: {
      opencode: { monthly: 15 } as never,
      commandcode: i < 12 ? ({ monthly: 20 } as never) : null,
    },
  }));

  it("accepts a whole table", () => {
    expect(refreshAccepted(catalogue, ["opencode", "commandcode"])).toBe(true);
  });

  it("refuses a table where a plan lost every row", () => {
    const lost = catalogue.map((m) => ({ ...m, plans: { ...m.plans, commandcode: null } }));
    expect(refreshAccepted(lost, ["opencode", "commandcode"])).toBe(false);
  });

  it("refuses a thin table", () => {
    expect(refreshAccepted(catalogue.slice(0, 20), ["opencode", "commandcode"])).toBe(false);
  });

  it("refuses a table with nothing shared to compare", () => {
    // Half the rows carry only one plan, so no model has two publishers.
    const solo = catalogue.map((m, i) => ({
      ...m,
      plans: (i % 2 === 0
        ? { opencode: m.plans.opencode, commandcode: null }
        : { opencode: null, commandcode: m.plans.commandcode }) satisfies ModelRow["plans"],
    }));
    expect(refreshAccepted(solo, ["opencode", "commandcode"])).toBe(false);
  });
});
