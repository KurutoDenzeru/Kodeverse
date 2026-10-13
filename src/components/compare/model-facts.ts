// Facts read off the data for one plan: how many models it carries.

import type { PlanData } from "@/lib/types";

/** Models carried is a count the vendor does publish, so it stays a number
 *  even when nothing else on a card can be. */
export const modelCount = (id: string, data: PlanData): number =>
  data.models.filter((m) => m.plans[id]).length;
