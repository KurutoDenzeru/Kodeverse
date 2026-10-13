// The changelog: diff the live figures against dated snapshots so a refresh
// reports what the vendors changed. Snapshot storage is injected, so the diff
// logic stays pure and testable without a browser.

import { money, reqText } from "./format";
import type { ModelRow, PlanData, PlanSide } from "./types";

export const HIST_KEY = "plan-compare.history.v1";
export const HIST_DAYS = 30;

/** One snapshot per UTC day. */
export interface Snapshot {
  at: string;
  models: Record<
    string,
    { name: string; plans: Record<string, Record<string, number | null> | null> }
  >;
}

const FIELDS: {
  k: keyof PlanSide;
  kind: string;
  label: string;
  fmt: (v: number | null | undefined) => string;
}[] = [
  { k: "monthly", kind: "allowance", label: "Monthly allowance", fmt: (v) => money(v) },
  { k: "input", kind: "price", label: "Input per 1M", fmt: (v) => money(v) },
  { k: "output", kind: "price", label: "Output per 1M", fmt: (v) => money(v) },
  { k: "cacheRead", kind: "price", label: "Cache read per 1M", fmt: (v) => money(v) },
  { k: "cacheWrite", kind: "price", label: "Cache write per 1M", fmt: (v) => money(v) },
  { k: "reqMonth", kind: "requests", label: "Requests per month", fmt: (v) => reqText(v) },
];

export const LOG_META: Record<string, { glyph: string; label: string; badge: string }> = {
  added: { glyph: "plus", label: "Added", badge: "badge-outline" },
  removed: { glyph: "minus", label: "Removed", badge: "badge-outline" },
  allowance: { glyph: "scale", label: "Allowance", badge: "badge-secondary" },
  price: { glyph: "tag", label: "Price", badge: "badge-secondary" },
  requests: { glyph: "bar-chart", label: "Requests", badge: "badge-secondary" },
};

export interface LogEntry {
  kind: string;
  model: string;
  plan: string;
  label?: string;
  text: string;
  when: string;
}

const pick = (side: PlanSide | null): Record<string, number | null> | null => {
  if (!side) return null;
  const o: Record<string, number | null> = {};
  for (const f of FIELDS)
    o[f.k as string] = side[f.k] === undefined ? null : (side[f.k] as number | null);
  return o;
};

export const snapshotOf = (data: PlanData): Snapshot => ({
  at: data.fetchedAt,
  models: Object.fromEntries(
    data.models.map((m: ModelRow) => [
      m.key,
      {
        name: m.name,
        plans: Object.fromEntries(data.plans.map((p) => [p.id, pick(m.plans[p.id])])),
      },
    ]),
  ),
});

export const dayKey = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

/** Anything past the window goes, and so does anything that is not a date key
 *  at all, so a damaged store cannot grow without bound. Reports whether it
 *  cut anything: pruning has to be written back even when no new day arrives. */
export const pruneHistory = (h: Record<string, Snapshot>, now = Date.now()): boolean => {
  const floor = now - HIST_DAYS * 86400000;
  let cut = false;
  for (const k of Object.keys(h)) {
    const t = Date.parse(k + "T00:00:00Z");
    if (!Number.isFinite(t) || t < floor) {
      delete h[k];
      cut = true;
    }
  }
  return cut;
};

/** Only the first snapshot of a day is written. Writing it again on a later
 *  refresh the same day would overwrite the baseline that same-day diff is
 *  measured from, and the change would drop out of the log entirely. */
export const recordDay = (
  h: Record<string, Snapshot>,
  snap: Snapshot,
): Record<string, Snapshot> => {
  const k = dayKey(snap.at);
  if (h[k]) return h;
  h[k] = snap;
  pruneHistory(h);
  return h;
};

export const diffSnapshots = (
  prev: Snapshot | null,
  next: Snapshot,
  labels: Record<string, string>,
): LogEntry[] | null => {
  if (!prev || !prev.models) return null;
  const out: LogEntry[] = [];
  const keys = new Set([...Object.keys(prev.models), ...Object.keys(next.models)]);
  for (const k of keys) {
    const a = prev.models[k];
    const b = next.models[k];
    if (!a) {
      out.push({
        kind: "added",
        model: b.name,
        plan: "Model list",
        text: "Listed now, absent from the last snapshot",
        when: next.at,
      });
      continue;
    }
    if (!b) {
      out.push({
        kind: "removed",
        model: a.name,
        plan: "Model list",
        text: "No longer listed on either doc",
        when: next.at,
      });
      continue;
    }
    for (const [sid, side] of Object.entries(b.plans)) {
      const x = a.plans[sid];
      const y = side;
      if (!x && !y) continue;
      const planLabel = labels[sid] ?? sid;
      if (!x && y) {
        out.push({
          kind: "added",
          model: b.name,
          plan: planLabel,
          text: "Added to the plan",
          when: next.at,
        });
        continue;
      }
      if (x && !y) {
        out.push({
          kind: "removed",
          model: a.name,
          plan: planLabel,
          text: "Dropped from the plan",
          when: next.at,
        });
        continue;
      }
      if (x == null || y == null) continue;
      for (const f of FIELDS) {
        const before = x[f.k as string];
        const after = (y as Record<string, number | null>)[f.k as string];
        if (before === after) continue;
        out.push({
          kind: f.kind,
          model: b.name,
          plan: planLabel,
          label: f.label,
          text: f.fmt(before) + " to " + f.fmt(after),
          when: next.at,
        });
      }
    }
  }
  return out.sort(
    (p, q) =>
      p.model.localeCompare(q.model) ||
      p.plan.localeCompare(q.plan) ||
      (p.label ?? "").localeCompare(q.label ?? ""),
  );
};

/** Snapshot sides carry plan ids; `labels` names them. */
export const buildLog = (
  h: Record<string, Snapshot>,
  live: Snapshot,
  labels: Record<string, string>,
): LogEntry[] => {
  const days = Object.keys(h).sort();
  const out: LogEntry[] = [];
  const last = days.length ? h[days[days.length - 1]] : null;
  for (const e of diffSnapshots(last, live, labels) || []) out.push(e);
  for (let i = days.length - 1; i >= 1; i--) {
    for (const e of diffSnapshots(h[days[i - 1]], h[days[i]], labels) || []) out.push(e);
  }
  return out;
};
