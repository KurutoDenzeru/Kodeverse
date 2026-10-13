// The read: a three-window stat row over one card per plan.
//
// The row is the whole comparison in one glance: what each plan allows in five
// hours, in a week, and in a month, and who wins how many of the comparable
// models in that window. A reader asking "same price, same allowance?" gets the
// answer before any scrolling, and the row earns its place by covering all
// three windows rather than repeating the monthly figure alone.
//
// Plain numbers in divided columns, not cards: the figures are the content, and
// a card box around each one would add three containers and no information.

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

/** The three windows, each with the rule a plan states and the figure it
 *  produces on its best model. The windows are the question a reader arrives
 *  with, so they are read off the same caps the cards state. */
const WINDOWS: { field: "five" | "week" | "monthly"; label: string; note: string }[] = [
  { field: "five", label: "Per 5 hours", note: "the cap you actually meet first" },
  { field: "week", label: "Per week", note: "the rolling weekly cap" },
  { field: "monthly", label: "Per month", note: "the monthly credit" },
];

/** What one plan allows in one window, on its best model. */
const windowFigure = (
  p: PlanMeta,
  data: PlanData,
  field: "five" | "week" | "monthly",
): number | null => {
  const caps = data.caps[p.id];
  if (caps.published === false) return null;
  if (field === "monthly") return peak(p.id, data) || null;
  if ("fiveHour" in caps) return field === "five" ? caps.fiveHour : caps.week;
  const top = peak(p.id, data);
  return top * (field === "five" ? caps.fiveHourPct : caps.weekPct);
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
  const ranked = data.plans
    .filter((p) => p.ranks !== false)
    .sort((a, b) => peak(b.id, data) / b.price - peak(a.id, data) / a.price);
  const unranked = data.plans.filter((p) => p.ranks === false);
  const shared = comparable(data).length;
  // One tally per window, because the winner is not the same plan in all three.
  const tallies = {
    five: tally("five", data),
    week: tally("week", data),
    monthly: tally("monthly", data),
  };

  return (
    <section id="read" className="px-5 pb-[clamp(40px,6vw,72px)] md:px-12">
      <div className="mx-auto max-w-[1360px]">
        {/* Three windows, one row. The plan figures sit under their own mark,
            and the tally under the figures, so a column reads top to bottom as
            what the plan allows and how often it leads. */}
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {WINDOWS.map(({ field, label, note }) => (
            <div key={field} className="bg-card p-[clamp(20px,2.6vw,28px)]">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 text-sm font-semibold tracking-tight">{label}</h3>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="fig cursor-default text-[11px] text-muted-foreground" />
                    }
                  >
                    {shared} models
                  </TooltipTrigger>
                  <TooltipContent>
                    {note}, across the {shared} models both plans publish
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-4 grid gap-3">
                {ranked.map((p) => {
                  const v = windowFigure(p, data, field);
                  const wins = tallies[field][p.id] ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <BrandMark id={p.id as "opencode" | "commandcode"} small />
                      <span className="fig text-[clamp(20px,2.2vw,26px)] font-bold leading-none tracking-[-0.03em]">
                        {v == null ? (
                          <span className="text-[0.7em] font-medium text-muted-foreground/70">
                            not published
                          </span>
                        ) : (
                          money(v)
                        )}
                      </span>
                      <span className="fig ml-auto text-xs text-muted-foreground">
                        wins {wins} of {shared}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mb-0 mt-4 border-t border-border pt-3 text-[13px] font-light text-muted-foreground">
                {tallies[field].tie
                  ? `${tallies[field].tie} of ${shared} tie`
                  : `no ties across ${shared} models`}
              </p>
            </div>
          ))}
        </div>

        {unranked.length > 0 && (
          <p className="mt-4 max-w-[76ch] text-sm font-light text-muted-foreground">
            {unranked
              .map(
                (p) =>
                  `${p.label} publishes no allowance figure, so there is nothing to rank it on`,
              )
              .join(". ")}
            .
          </p>
        )}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
