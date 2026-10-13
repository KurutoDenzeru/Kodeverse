// The baked data shape: what scripts/update.mjs writes, what the page reads.

/** Where a model's figures came from. */
export type PlanId = string;

/** Cap rules. A plan either states flat dollar caps, derives each window as a
 *  share of the model's own monthly limit, or publishes nothing at all. */
export interface FlatCaps {
  published?: true;
  fiveHour: number;
  week: number;
}
export interface DerivedCaps {
  published?: true;
  fiveHourPct: number;
  weekPct: number;
}
export interface UnpublishedCaps {
  published: false;
}
export type PlanCaps = FlatCaps | DerivedCaps | UnpublishedCaps;

export interface PlanMeta {
  id: PlanId;
  /** Colour class used across the page for this plan's marks and figures. */
  cls: string;
  label: string;
  short: string;
  price: number;
  /** Promotional price when a vendor lists one beside the list price. */
  introPrice?: number;
  src: string;
  /** Source format the reader must use: "md" or "html". */
  fmt: string;
  note: string;
  /** A plan with ranks false is carried but never ranked on allowance. */
  ranks?: boolean;
}

/** One plan's figures for one model. */
export interface PlanSide {
  name: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** Monthly credit. -1 means unlimited, null means the plan does not publish it. */
  monthly: number | null;
  promo?: string;
  req5h?: number | null;
  reqWeek?: number | null;
  reqMonth?: number | null;
  /** Dollars this model may spend in five hours under this plan's cap rule. */
  five: number | null;
  /** Dollars this model may spend in a week under this plan's cap rule. */
  week: number | null;
}

export interface ModelRow {
  key: string;
  name: string;
  plans: Record<string, PlanSide | null>;
}

export interface PlanData {
  fetchedAt: string;
  sources: Record<string, string>;
  plans: PlanMeta[];
  caps: Record<string, PlanCaps>;
  models: ModelRow[];
}
