// Merge two vendor catalogues into the page's model rows. Shared by
// scripts/update.mjs (build time) and the browser refresh (client), so a
// refresh produces exactly the shape a build produces.

import { normKey, type VendorModelWithRequests } from "./parsers";
import type { ModelRow, PlanCaps, PlanId, PlanSide } from "./types";

const capsFor = (
  monthly: number | null,
  caps: PlanCaps,
  window: "five" | "week",
): number | null => {
  if (caps.published === false || monthly == null) return null;
  if (monthly === -1) return -1;
  if ("fiveHour" in caps) {
    const flat = window === "five" ? caps.fiveHour : caps.week;
    return flat == null ? null : Math.min(monthly, flat);
  }
  const pct = window === "five" ? caps.fiveHourPct : caps.weekPct;
  return pct == null ? null : monthly * pct;
};

/** groups is [[planId, models]], caps is read per plan from the caller, never
 *  from the plan id, so a fourth provider needs no change here and a plan that
 *  publishes none gets null rather than another plan's numbers. */
export function mergeModels(
  groups: [string, VendorModelWithRequests[]][],
  caps: Record<string, PlanCaps>,
): ModelRow[] {
  const blank = Object.fromEntries(groups.map(([id]) => [id, null]));
  const map = new Map<string, ModelRow>();
  // Vendor tables list the cheapest size or time tier first (off-peak, <=272K),
  // so the first row seen for a key wins and the pricier tiers collapse away.
  const put = (model: VendorModelWithRequests, src: string) => {
    const k = normKey(model.name);
    const side: PlanSide = {
      ...model,
      source: src,
      five: capsFor(model.monthly, caps[src], "five"),
      week: capsFor(model.monthly, caps[src], "week"),
    } as PlanSide;
    const row = map.get(k);
    if (row) {
      if (!row.plans[src]) row.plans[src] = side;
      return;
    }
    map.set(k, { key: k, name: model.name, plans: { ...blank, [src]: side } });
  };
  for (const [id, models] of groups) for (const m of models) put(m, id);
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

/** Plans that must be present and carrying rows, keyed by plan id. A caller
 *  uses this to refuse a refresh that silently lost a plan. */
export const PLAN_ORDER: PlanId[] = ["opencode", "commandcode"];

/** The contract a refreshed table must meet before it may replace the figures
 *  on screen: every plan still carries rows, the catalogue is not a fragment,
 *  and enough models are shared to compare. A reply that fails any of these is
 *  refused rather than half-applied, so a half-read page cannot quietly
 *  replace good figures with worse ones. */
export const refreshAccepted = (models: ModelRow[], planIds: string[]): boolean => {
  if (models.length < 40) return false;
  if (!planIds.every((id) => models.some((m) => m.plans[id]))) return false;
  const shared = models.filter((m) => planIds.filter((id) => m.plans[id]).length >= 2);
  return shared.length >= 10;
};
