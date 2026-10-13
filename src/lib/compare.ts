// Comparison rules: who leads a model on a field, by how much, and how the
// wins tally across the shared set. Pure functions over the baked data.

import type { ModelRow, PlanData, PlanSide } from "./types";

/** The numeric fields a plan can compete on. monthly, five and week are the
 *  allowance fields in dollars; req5h, reqWeek and reqMonth are the vendors'
 *  own request estimates per window. */
export type CompeteField = "monthly" | "five" | "week" | "req5h" | "reqWeek" | "reqMonth";

const RATE_FIELDS = ["input", "output", "cacheRead", "cacheWrite"] as const;
type RateField = (typeof RATE_FIELDS)[number];

/** -1 is the marker the parsers store for "unlimited". It has to compare as
 *  the largest value there is, or a plan that publishes no cap would rank last
 *  and the capped plan would be named the winner. */
export const MAGNITUDE = (v: number): number => (v === -1 ? Infinity : v);

export const on = (m: ModelRow, data: PlanData): string[] =>
  data.plans.map((p) => p.id).filter((id) => m.plans[id]);

/** A plan ranks on allowance only if it publishes an allowance to rank on. */
export const ranks = (id: string, data: PlanData): boolean =>
  (data.plans.find((p) => p.id === id)?.ranks ?? true) !== false;

/** Comparable means two ranking plans actually publish the figure the table is
 *  competing on. A model one plan merely carries has nothing to compare, and
 *  a model both carry but neither publishes a figure for is the same silence,
 *  so both stay out of the set rather than showing up as a row of dashes. */
export const comparable = (data: PlanData, field: CompeteField = "monthly"): ModelRow[] =>
  data.models.filter(
    (m) =>
      on(m, data).filter((id) => ranks(id, data) && typeof m.plans[id]?.[field] === "number")
        .length >= 2,
  );

/** Only plans that both rank and actually publish this figure for this model.
 *  A plan carrying the model without a number for the field is carrying it,
 *  not competing on it. */
const competing = (m: ModelRow, data: PlanData, k: CompeteField): string[] =>
  on(m, data).filter((id) => ranks(id, data) && typeof m.plans[id]?.[k] === "number");

export interface Leader {
  /** The plan leading, or null when the top figure is tied. */
  id: string | null;
  top: number;
  ids: string[];
  k: CompeteField;
}

export const leader = (m: ModelRow, data: PlanData, k: CompeteField): Leader | null => {
  const list = competing(m, data, k);
  if (list.length < 2) return null;
  const figures = list.map((id) => ({ id, v: m.plans[id]![k] as number }));
  const top = figures.reduce((a, b) => (MAGNITUDE(b.v) > MAGNITUDE(a.v) ? b : a)).v;
  const tied = figures.filter((f) => f.v === top);
  return { id: tied.length === 1 ? tied[0].id : null, top, ids: list, k };
};

/** How far ahead the leader is, in the unit of the field it leads. A field
 *  where the leader publishes no cap has no gap to report, and says so with 0. */
export const gapOf = (m: ModelRow, l: Leader | null): number => {
  if (!l) return 0;
  const rest = l.ids.filter((id) => MAGNITUDE(m.plans[id]![l.k] as number) < MAGNITUDE(l.top));
  return rest.length ? l.top - Math.max(...rest.map((id) => m.plans[id]![l.k] as number)) : 0;
};

/** A price difference only counts when it is real, not a rounding artifact. */
export const TOLERANCE = 1.02;

const priceSplit = (m: ModelRow, data: PlanData): string[] => {
  const list = on(m, data);
  if (list.length < 2) return [];
  return RATE_FIELDS.filter((f) => {
    const v = list.map((id) => m.plans[id]?.[f]).filter((x): x is number => x != null);
    return v.length > 1 && Math.max(...v) > Math.min(...v) * TOLERANCE;
  });
};

/** The cheapest rate a model is carried at, and which plan quotes it. */
const priceOf = (m: ModelRow, data: PlanData, f: RateField): { v: number; id: string } | null => {
  let best: { v: number; id: string } | null = null;
  for (const id of on(m, data)) {
    const v = m.plans[id]?.[f];
    if (v == null) continue;
    if (!best || v < best.v) best = { v, id };
  }
  return best;
};

export type Window = "five" | "week" | "month";

const REQ_FIELD: Record<Window, CompeteField> = {
  five: "req5h",
  week: "reqWeek",
  month: "reqMonth",
};

export const reqOf = (m: ModelRow, id: string, win: Window): number | null | undefined =>
  m.plans[id]?.[REQ_FIELD[win]];

/** Summed requests over the shared models for one window. One unlimited model
 *  in the set would make a total meaningless, so bail out rather than guess. */
export const reqSum = (id: string, win: Window, pool: ModelRow[]): number => {
  let total = 0;
  for (const m of pool) {
    const r = reqOf(m, id, win);
    if (r == null) continue;
    if (r === -1) return -1;
    total += r;
  }
  return total;
};

export const tallyKinds = (data: PlanData): string[] =>
  data.plans.filter((p) => ranks(p.id, data)).map((p) => p.id);

export const tally = (k: CompeteField, data: PlanData): Record<string, number> => {
  const counts: Record<string, number> = { tie: 0 };
  for (const id of tallyKinds(data)) counts[id] = 0;
  for (const m of comparable(data, k)) {
    const l = leader(m, data, k);
    if (!l) continue;
    if (l.id) counts[l.id]++;
    else counts.tie++;
  }
  return counts;
};

/** Does this plan publish figures for a field at all. Used to tell a cell that
 *  is genuinely missing apart from one that simply was not asked for. */
export const publishes = (id: string, field: string, data: PlanData): boolean =>
  data.models.some(
    (m) => m.plans[id] && typeof m.plans[id]?.[field as keyof PlanSide] === "number",
  );

export const silentFor = (field: string, data: PlanData): string[] =>
  data.plans.filter((p) => !ranks(p.id, data) || !publishes(p.id, field, data)).map((p) => p.id);

export { priceSplit, priceOf };
