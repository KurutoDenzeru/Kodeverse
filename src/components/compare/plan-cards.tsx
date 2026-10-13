// The read: the verdict strip over one card per plan. The strip states the
// best case across every plan, which is the figure a reader arriving here came
// for. Each card states that plan's own cap rule and the figures that follow
// from it, so no number is printed twice and a plan that publishes nothing
// says so on every figure instead of printing a zero.

import { Card, CardContent } from "@/components/ui/card";
import { comparable, tally } from "@/lib/compare";
import { money } from "@/lib/format";
import type { PlanData, PlanMeta } from "@/lib/types";

import { BrandMark } from "./brand-mark";
import { modelCount } from "./model-facts";

/** The best monthly allowance any model of this plan publishes. */
const peak = (id: string, data: PlanData): number =>
  Math.max(
    0,
    ...data.models
      .filter((m) => m.plans[id] && m.plans[id]!.monthly! > 0)
      .map((m) => m.plans[id]!.monthly!),
  );

/** The range of published monthly allowances, so "the best case" is not the
 *  only figure a card claims. */
const spread = (id: string, data: PlanData): string => {
  const v = [
    ...new Set(
      data.models
        .filter((m) => m.plans[id] && m.plans[id]!.monthly! > 0)
        .map((m) => m.plans[id]!.monthly!),
    ),
  ].sort((a, b) => a - b);
  return v.length ? "$" + v[0] + " to $" + v[v.length - 1] : "-";
};

const capRuleText = (
  p: PlanMeta,
  data: PlanData,
): { rows: [string, string][]; derived: boolean } | null => {
  const caps = data.caps[p.id];
  if (caps.published === false) {
    return {
      derived: false,
      rows: [
        ["Five hours", "not published"],
        ["Per week", "not published"],
        ["Per month", "not published"],
      ],
    };
  }
  if ("fiveHour" in caps) {
    return {
      derived: false,
      rows: [
        ["Five hours", money(caps.fiveHour) + " flat, every model"],
        ["Per week", money(caps.week) + " flat, every model"],
      ],
    };
  }
  return {
    derived: true,
    rows: [
      ["Five hours", Math.round(caps.fiveHourPct * 100) + "% of that model limit"],
      ["Per week", Math.round(caps.weekPct * 100) + "% of that model limit"],
    ],
  };
};

const capFigures = (p: PlanMeta, data: PlanData): { five: number | null; week: number | null } => {
  const caps = data.caps[p.id];
  if (caps.published === false) return { five: null, week: null };
  const top = peak(p.id, data);
  if ("fiveHour" in caps) return { five: caps.fiveHour, week: caps.week };
  return { five: top * caps.fiveHourPct, week: top * caps.weekPct };
};

export function PlanCards({
  data,
  selected,
  onSelect,
}: {
  data: PlanData;
  selected: string;
  onSelect: (id: string) => void;
}) {
  // Which plans can be ranked is decided by the data, not by their ids, so a
  // fourth provider needs no change here.
  const ranked = data.plans
    .filter((p) => p.ranks !== false)
    .sort((a, b) => peak(b.id, data) / b.price - peak(a.id, data) / a.price);
  const unranked = data.plans.filter((p) => p.ranks === false);
  const shared = comparable(data).length;
  const tM = tally("monthly", data);

  return (
    <section id="read" className="px-5 py-[clamp(40px,6vw,72px)] md:px-12">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-3">
        <Card className="bg-secondary">
          <CardContent className="grid gap-4 p-[clamp(22px,3vw,30px)] sm:grid-cols-[minmax(200px,auto)_minmax(0,1fr)] sm:gap-11">
            <div>
              <p className="fig m-0 text-[clamp(40px,5.6vw,66px)] font-bold leading-none tracking-[-0.05em]">
                {ranked.length
                  ? "x" + (peak(ranked[0].id, data) / ranked[0].price).toFixed(1)
                  : "-"}
              </p>
              <p className="mt-3 max-w-[36ch] font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground">
                {ranked.length
                  ? "Best published monthly allowance, best model"
                  : "No plan publishes a monthly allowance"}
              </p>
            </div>
            <div>
              <p className="m-0 max-w-[70ch] text-[15px] font-light leading-relaxed text-muted-foreground">
                {ranked.length > 0 && (
                  <>
                    <b className="font-semibold text-foreground">{ranked[0].label}</b> grants the
                    most credit on any model it publishes.{" "}
                  </>
                )}
                {ranked.length > 1 && (
                  <>
                    <b className="font-semibold text-foreground">{ranked[1].label}</b> follows at x
                    {(peak(ranked[1].id, data) / ranked[1].price).toFixed(1)}.{" "}
                  </>
                )}
                That is the best case. The five-hour cap is the number you actually meet.
                {unranked.map((p) => (
                  <span key={p.id}>
                    {" "}
                    <b className="font-semibold text-foreground">{p.label}</b> publishes no
                    allowance figure, so there is nothing to rank it on: its rates are the only
                    honest comparison.
                  </span>
                ))}
              </p>
              <ul className="mt-[18px] flex list-none flex-wrap gap-x-[34px] gap-y-3 border-t border-border p-0 pt-[18px]">
                {ranked.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline gap-2.5 font-mono text-xs text-muted-foreground"
                  >
                    <b
                      className={
                        "fig text-[22px] font-bold tracking-[-0.03em] " +
                        (p.cls === "goat" ? "text-goat" : "text-go")
                      }
                    >
                      {tM[p.id] ?? 0}
                    </b>
                    {p.short} wins
                  </li>
                ))}
                <li className="flex items-baseline gap-2.5 font-mono text-xs text-muted-foreground">
                  <b className="fig text-[22px] font-bold tracking-[-0.03em]">{tM.tie ?? 0}</b>
                  tied
                </li>
                <li className="self-end pb-0.5 text-muted-foreground/70">
                  across {shared} models {ranked.length} plans publish an allowance for
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {data.plans.map((p) => {
            const rule = capRuleText(p, data);
            const figs = capFigures(p, data);
            const on = p.id === selected;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(p.id)}
                className={
                  "rounded-xl border bg-card p-[clamp(20px,2.6vw,30px)] text-left transition-colors " +
                  (p.cls === "goat"
                    ? on
                      ? "border-goat bg-goat/[0.07]"
                      : "border-border hover:border-goat/50"
                    : on
                      ? "border-go bg-go/[0.07]"
                      : "border-border hover:border-go/50")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="m-0 flex items-center gap-2.5 text-[clamp(20px,2.4vw,29px)] font-bold tracking-[-0.03em]">
                    <BrandMark id={p.id as "opencode" | "commandcode"} />
                    {p.label}
                  </h3>
                  <span className="fig text-[21px] font-bold">
                    {p.introPrice ? (
                      <s className="mr-2 font-normal text-[0.62em] text-muted-foreground">
                        ${p.price}
                      </s>
                    ) : null}
                    ${p.introPrice ?? p.price}/mo
                  </span>
                </div>

                <div className="mt-6 border-t border-border pt-5">
                  <p className="mb-3.5 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                    How it caps
                  </p>
                  <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-2">
                    {rule?.rows.map(([k, v]) => (
                      <div key={k} className="col-span-2 grid grid-cols-subgrid items-baseline">
                        <dt className="fig text-xs font-medium text-muted-foreground">{k}</dt>
                        <dd
                          className={
                            "m-0 fig text-[15px] font-semibold tracking-[-0.02em] " +
                            (v === "not published"
                              ? "font-medium text-muted-foreground/70"
                              : rule.derived
                                ? "font-medium text-muted-foreground"
                                : "")
                          }
                        >
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-x-[26px] gap-y-5">
                  <div className="col-span-2">
                    <p className="mb-2 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                      Best case month
                    </p>
                    <p className="fig m-0 text-[clamp(27px,3.2vw,35px)] font-bold leading-none tracking-[-0.03em]">
                      {money(peak(p.id, data))}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                      Per 5 hours
                    </p>
                    <p className="fig m-0 text-[clamp(17px,1.8vw,21px)] font-bold leading-none tracking-[-0.03em]">
                      {figs.five == null ? (
                        <span className="text-[0.8em] font-medium text-muted-foreground/70">
                          not published
                        </span>
                      ) : (
                        money(figs.five)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                      Per week
                    </p>
                    <p className="fig m-0 text-[clamp(17px,1.8vw,21px)] font-bold leading-none tracking-[-0.03em]">
                      {figs.week == null ? (
                        <span className="text-[0.8em] font-medium text-muted-foreground/70">
                          not published
                        </span>
                      ) : (
                        money(figs.week)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                      Models carried
                    </p>
                    <p className="fig m-0 text-[clamp(17px,1.8vw,21px)] font-bold leading-none tracking-[-0.03em]">
                      {modelCount(p.id, data)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-foreground">
                      Monthly range
                    </p>
                    <p className="fig m-0 text-[clamp(17px,1.8vw,21px)] font-bold leading-none tracking-[-0.03em]">
                      {spread(p.id, data)}
                    </p>
                  </div>
                </div>

                <p className="mb-0 mt-6 max-w-[70ch] text-sm font-light text-muted-foreground">
                  {p.note}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
