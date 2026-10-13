// The comparison rules, tested against literal figures: who leads, by how
// much, what counts as a tie, and which models are comparable at all.

import { describe, expect, it } from "vitest";

import {
  MAGNITUDE,
  comparable,
  gapOf,
  leader,
  priceOf,
  priceSplit,
  ranks,
  reqSum,
  silentFor,
  tally,
} from "./compare";
import type { ModelRow, PlanData, PlanMeta, PlanSide } from "./types";

const side = (over: Partial<PlanSide> = {}): PlanSide => ({
  name: "M",
  input: null,
  output: null,
  cacheRead: null,
  cacheWrite: null,
  monthly: null,
  five: null,
  week: null,
  ...over,
});

const PLANS: PlanMeta[] = [
  {
    id: "opencode",
    cls: "go",
    label: "OpenCode Go",
    short: "Go",
    price: 10,
    src: "https://opencode.example/go",
    fmt: "md",
    note: "",
  },
  {
    id: "commandcode",
    cls: "goat",
    label: "Command Code GOAT",
    short: "GOAT",
    price: 10,
    src: "https://commandcode.example/goat",
    fmt: "html",
    note: "",
  },
];

const row = (key: string, plans: Record<string, PlanSide | null>): ModelRow => ({
  key,
  name: plans.opencode?.name ?? plans.commandcode?.name ?? key,
  plans,
});

const dataOf = (models: ModelRow[]): PlanData => ({
  fetchedAt: "2026-10-13T00:00:00.000Z",
  sources: {},
  plans: PLANS,
  caps: { opencode: { fiveHourPct: 0.2, weekPct: 0.5 }, commandcode: { fiveHour: 14, week: 35 } },
  models,
});

describe("magnitude", () => {
  it("treats an unlimited allowance as the largest value there is", () => {
    expect(MAGNITUDE(-1)).toBe(Infinity);
    expect(MAGNITUDE(-1)).toBeGreaterThan(MAGNITUDE(1_000_000));
    expect(MAGNITUDE(20)).toBe(20);
  });
});

describe("leader", () => {
  const both = dataOf([
    row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: 20 }) }),
  ]);

  it("names the plan with the larger figure", () => {
    const l = leader(both.models[0], both, "monthly");
    expect(l?.id).toBe("commandcode");
    expect(l?.top).toBe(20);
  });

  it("reports a level top as a tie rather than a win", () => {
    const tied = dataOf([
      row("a", { opencode: side({ monthly: 20 }), commandcode: side({ monthly: 20 }) }),
    ]);
    const l = leader(tied.models[0], tied, "monthly");
    expect(l?.id).toBeNull();
    expect(l?.top).toBe(20);
  });

  it("has no leader when only one plan publishes the figure", () => {
    const solo = dataOf([row("a", { opencode: side({ monthly: 15 }), commandcode: null })]);
    expect(leader(solo.models[0], solo, "monthly")).toBeNull();
  });

  it("has no leader when the second plan carries the model but publishes nothing", () => {
    const silent = dataOf([
      row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: null }) }),
    ]);
    expect(leader(silent.models[0], silent, "monthly")).toBeNull();
  });

  it("lets an unlimited allowance win over a capped one", () => {
    const unlimited = dataOf([
      row("a", { opencode: side({ monthly: 80 }), commandcode: side({ monthly: -1 }) }),
    ]);
    expect(leader(unlimited.models[0], unlimited, "monthly")?.id).toBe("commandcode");
  });
});

describe("gap", () => {
  it("measures from the next figure down, not from zero", () => {
    const d = dataOf([
      row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: 20 }) }),
    ]);
    expect(gapOf(d.models[0], leader(d.models[0], d, "monthly"))).toBe(5);
  });

  it("is zero when the leader is the only publisher", () => {
    const d = dataOf([row("a", { opencode: null, commandcode: side({ monthly: 20 }) })]);
    expect(gapOf(d.models[0], leader(d.models[0], d, "monthly"))).toBe(0);
  });
});

describe("comparable", () => {
  const d = dataOf([
    row("shared", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: 20 }) }),
    row("solo", { opencode: side({ monthly: 15 }), commandcode: null }),
    row("carried", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: null }) }),
    row("reqs", {
      opencode: side({ monthly: null, req5h: 100 }),
      commandcode: side({ monthly: null, req5h: 200 }),
    }),
  ]);

  it("keeps only models both plans publish the field for", () => {
    expect(comparable(d, "monthly").map((m) => m.key)).toEqual(["shared"]);
  });

  it("follows the field, so the requests view has its own set", () => {
    expect(comparable(d, "req5h").map((m) => m.key)).toEqual(["reqs"]);
  });
});

describe("tally", () => {
  const d = dataOf([
    row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: 20 }) }),
    row("b", { opencode: side({ monthly: 20 }), commandcode: side({ monthly: 15 }) }),
    row("c", { opencode: side({ monthly: 20 }), commandcode: side({ monthly: 20 }) }),
    row("solo", { opencode: side({ monthly: 90 }), commandcode: null }),
  ]);

  it("credits every comparable model exactly once", () => {
    const t = tally("monthly", d);
    expect(t).toEqual({ tie: 1, opencode: 1, commandcode: 1 });
  });

  it("never credits a model that has nothing to compare", () => {
    const t = tally("monthly", d);
    const credited = t.opencode + t.commandcode + t.tie;
    expect(credited).toBe(comparable(d, "monthly").length);
    expect(credited).toBe(3);
  });
});

describe("prices", () => {
  it("ignores a difference that is a rounding artifact", () => {
    const d = dataOf([
      row("a", {
        opencode: side({ input: 1 }),
        commandcode: side({ input: 1.01 }),
      }),
    ]);
    expect(priceSplit(d.models[0], d)).toEqual([]);
  });

  it("reports a real difference by field", () => {
    const d = dataOf([
      row("a", {
        opencode: side({ input: 0.1, output: 2 }),
        commandcode: side({ input: 0.11, output: 2 }),
      }),
    ]);
    expect(priceSplit(d.models[0], d)).toEqual(["input"]);
  });

  it("names the plan quoting the cheaper rate", () => {
    const d = dataOf([
      row("a", { opencode: side({ input: 0.1 }), commandcode: side({ input: 0.2 }) }),
    ]);
    expect(priceOf(d.models[0], d, "input")).toEqual({ v: 0.1, id: "opencode" });
  });

  it("has no cheaper rate when neither plan publishes one", () => {
    const d = dataOf([
      row("a", { opencode: side({ input: null }), commandcode: side({ input: null }) }),
    ]);
    expect(priceOf(d.models[0], d, "input")).toBeNull();
  });
});

describe("request sums", () => {
  const d = dataOf([
    row("a", { opencode: side({ req5h: 100 }), commandcode: side({ req5h: 200 }) }),
    row("b", { opencode: side({ req5h: 50 }), commandcode: null }),
    row("free", { opencode: side({ req5h: -1 }), commandcode: side({ req5h: 300 }) }),
  ]);

  it("sums what is published, skips what is not, and bails on an unlimited row", () => {
    // The free row makes a total meaningless, so the whole sum bails rather
    // than quietly answering a number that is smaller than the truth.
    expect(reqSum("opencode", "five", d.models)).toBe(-1);
    expect(reqSum("commandcode", "five", d.models)).toBe(500);
  });

  it("bails out rather than guess when one row is unlimited", () => {
    expect(reqSum("opencode", "five", d.models.slice(2))).toBe(-1);
  });
});

describe("ranks and silence", () => {
  it("ranks a plan by default and drops it when it says not to", () => {
    const d = dataOf([
      row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: 20 }) }),
    ]);
    d.plans[1] = { ...d.plans[1], ranks: false };
    expect(ranks("opencode", d)).toBe(true);
    expect(ranks("commandcode", d)).toBe(false);
    // A plan that does not rank is not comparable either.
    expect(comparable(d, "monthly")).toEqual([]);
  });

  it("names a plan that publishes no figure for a field", () => {
    const d = dataOf([
      row("a", { opencode: side({ monthly: 15 }), commandcode: side({ monthly: null }) }),
    ]);
    expect(silentFor("monthly", d)).toEqual(["commandcode"]);
    expect(silentFor("req5h", d)).toEqual(["opencode", "commandcode"]);
  });
});
