// The changelog history, read from the browser's localStorage through a store
// subscription. The server has no storage, so it renders a first visit and the
// client switches to the stored days after hydration. Doing this with a store
// snapshot is what keeps the two renders from disagreeing: during hydration
// React reads the server snapshot, and only then reads the real one.

import { useSyncExternalStore } from "react";

import { pruneHistory, recordDay, snapshotOf, type Snapshot } from "@/lib/changelog";
import type { PlanData } from "@/lib/types";

const KEY = "plan-compare.history.v1";

const readHistory = (): Record<string, Snapshot> => {
  let h: Record<string, Snapshot> = {};
  if (typeof localStorage === "undefined") return h;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) h = parsed;
  } catch {
    h = {};
  }
  return h;
};

const writeHistory = (h: Record<string, Snapshot>): void => {
  // A private window or a spent quota leaves the log rendering without a
  // memory, which is not fatal: today's entry simply is not kept.
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* no storage */
  }
};

// One cached snapshot per data object, so repeated calls in one render return
// the same object. React compares snapshots with Object.is.
const cache = new WeakMap<PlanData, Record<string, Snapshot>>();

const snapshotFor = (data: PlanData): Record<string, Snapshot> => {
  const cached = cache.get(data);
  if (cached) return cached;
  const h = readHistory();
  if (pruneHistory(h)) writeHistory(h);
  // Only the first snapshot of a day is written. Writing it again on a later
  // refresh the same day would overwrite the baseline that same-day diff is
  // measured from, and the change would drop out of the log entirely.
  const next = recordDay(h, snapshotOf(data));
  writeHistory(next);
  cache.set(data, next);
  return next;
};

export const useHistory = (data: PlanData): Record<string, Snapshot> =>
  useSyncExternalStore(
    // This module is the only writer, and it writes while rendering, so there
    // is nothing to subscribe to.
    () => () => {},
    () => snapshotFor(data),
    () => ({}),
  );
