// How the numbers are read: the rules shown rather than described. The window
// arithmetic is worked out on a real model, and each card carries a figure
// from this page's own data, so nothing here asserts something the reader
// cannot check against the tables above.
import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { comparable, priceSplit, ranks, tally } from "@/lib/compare";
import { money, pad2 } from "@/lib/format";
import type { ModelRow, PlanData, PlanSide } from "@/lib/types";
import { zoneCity } from "@/lib/zone";

import { BrandMark } from "./brand-mark";
import type { ViewState } from "./view";

/** DeepSeek peak windows are 01:00-04:00 and 06:00-10:00 UTC, so the state
 *  only changes on those four hours. */
const PEAK = [
  [1, 4],
  [6, 10],
] as const;
const isPeak = (h: number) => PEAK.some(([a, b]) => h >= a && h < b);
const EDGES = [1, 4, 6, 10];
const nextBoundary = (h: number) => EDGES.find((x) => x > h) ?? 1;

/** Caps come from each plan's own limits entry, read off the data rather than
 *  assumed from the plan id, so a flat cap, a derived cap and no cap each get
 *  the sentence that is true of them. */
const ruleOf = (p: PlanData["plans"][number], data: PlanData): string => {
  const caps = data.caps[p.id];
  if (caps.published === false) return "names its windows and publishes no figure for any of them";
  if ("fiveHour" in caps) {
    return (
      "uses flat caps of $" + caps.fiveHour + " for five hours and $" + caps.week + " for a week"
    );
  }
  return (
    "takes " +
    Math.round(caps.fiveHourPct * 100) +
    "% of each model's own limit for five hours and " +
    Math.round(caps.weekPct * 100) +
    "% for a week"
  );
};

export function MethodSection({
  data,
  view,
  patch,
  selected,
}: {
  data: PlanData;
  view: ViewState;
  patch: (p: Partial<ViewState>) => void;
  selected: string;
}) {
  const pool = useMemo(() => comparable(data), [data]);
  // One clock for the whole section, advanced in an effect. Reading the clock
  // during render would make every render disagree with the last one; a state
  // value advances once a second and stays pure between ticks.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const uh = now.getUTCHours();

  // The model the example works through, defaulting to the DeepSeek V4.1
  // Flash (Off-Peak) that both shared plans carry. A refresh that retires the
  // chosen model falls back rather than stranding the example on a stale one.
  let pick = pool.find((m) => m.key === view.modelEx) ?? null;
  if (!pick) {
    pick = pool.find((m) => m.key === "deepseek41flash") ?? null;
    if (!pick) {
      const served = (m: ModelRow) =>
        Math.max(...data.plans.map((p) => (m.plans[p.id] ? (m.plans[p.id]!.reqMonth ?? 0) : 0)), 0);
      const deep = pool.filter((m) => m.name.startsWith("DeepSeek"));
      pick = (deep.length ? deep : pool).reduce((a, b) => (served(b) > served(a) ? b : a));
    }
  }

  const about = data.plans.find((p) => p.id === selected) ?? data.plans[0];
  const sharedCount = pool.length;
  const t5 = tally("five", data);
  const ranking = data.plans.filter((p) => ranks(p.id, data));

  // A figure is highlighted when its plan publishes one that no other plan
  // carrying this model matches.
  const numsFor = (k: keyof PlanSide) =>
    data.plans
      .filter((p) => pick!.plans[p.id] && typeof pick!.plans[p.id]![k] === "number")
      .map((p) => pick!.plans[p.id]![k] as number);
  const isBest = (k: keyof PlanSide, v: number) => {
    const all = numsFor(k);
    return all.length > 1 && v === Math.max(...all) && all.filter((x) => x === v).length === 1;
  };

  const splitModels = pool.filter((m) => priceSplit(m, data).length > 0);
  // The sample is a rate the selected plan publishes, so the card sits beside
  // the worked example rather than describing a different provider.
  const sample =
    pool.find(
      (m) =>
        m.plans[about.id] && m.plans[about.id]!.input != null && priceSplit(m, data).length === 0,
    ) ??
    pool.find((m) => m.plans[about.id] && m.plans[about.id]!.input != null) ??
    null;

  return (
    <section
      id="method"
      className="border-t border-border px-5 py-[clamp(60px,9vh,116px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-[clamp(24px,4vh,40px)] max-w-[60ch]">
          <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
            How the numbers are read
          </h2>
          <p className="mt-3.5 max-w-[56ch] font-light text-muted-foreground">
            Everything here comes from the vendor pages listed in the footer. Nothing is estimated
            unless it says so.
          </p>
          <div className="mt-5 flex items-center gap-2.5">
            <Label
              htmlFor="method-model"
              className="fig text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground"
            >
              Model
            </Label>
            <Select
              value={pick.key}
              onValueChange={(v) => patch({ modelEx: String(v) })}
              items={Object.fromEntries(pool.map((m) => [m.key, m.name]))}
            >
              <SelectTrigger
                id="method-model"
                aria-label="Model the example works through"
                className="min-w-[260px]"
              >
                <SelectValue className="text-sm first-letter:uppercase" />
              </SelectTrigger>
              <SelectContent>
                {pool.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-3.5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 pt-[22px]">
            <div className="flex flex-wrap items-center gap-3.5">
              {pick.name.startsWith("DeepSeek") && <BrandMark id="deepseek" />}
              <h3 className="m-0 text-[clamp(20px,2.4vw,28px)] font-bold tracking-[-0.03em]">
                {pick.name}
              </h3>
            </div>
          </div>

          {/* One panel per plan, not a table. The plans are the two sides of
              the comparison, and a panel lets each side state its three
              figures at size; a table would put the plan names in a narrow
              first column and squeeze the numbers that matter. */}
          <div className="grid gap-px bg-border md:grid-cols-2">
            {data.plans.map((p) => {
              const v = pick.plans[p.id];
              const isAbout = p.id === about.id;
              return (
                <div
                  key={p.id}
                  className={
                    "bg-card px-6 py-5 " +
                    (isAbout ? (p.cls === "goat" ? "bg-goat/[0.06]" : "bg-go/[0.06]") : "")
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <BrandMark id={p.id as "opencode" | "commandcode"} small />
                    <span
                      className={
                        "text-sm font-semibold " +
                        (isAbout ? (p.cls === "goat" ? "text-goat" : "text-go") : "")
                      }
                    >
                      {p.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    {(["monthly", "five", "week"] as const).map((k) => {
                      const val = v ? v[k] : null;
                      const best = val != null && isBest(k, val);
                      return (
                        <div key={k}>
                          <p className="mb-1.5 font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-muted-foreground">
                            {{ monthly: "Monthly", five: "Per 5 hours", week: "Per week" }[k]}
                          </p>
                          <p
                            className={
                              "fig m-0 text-[clamp(19px,2vw,26px)] font-bold leading-none tracking-[-0.03em] " +
                              (best ? (p.cls === "goat" ? "text-goat" : "text-go") : "")
                            }
                          >
                            {val == null ? (
                              <span className="text-[0.7em] font-medium text-muted-foreground/70">
                                not published
                              </span>
                            ) : (
                              money(val)
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="m-0 flex items-start gap-2.5 border-t border-border px-6 py-5 text-base font-light text-muted-foreground">
            <Info className="mt-1.5 size-4 shrink-0 text-muted-foreground/70" aria-hidden />
            {ranking.map((p) => p.label + " " + ruleOf(p, data)).join(". ") +
              ". " +
              "Across the " +
              sharedCount +
              " models " +
              ranking.length +
              " plans both publish, that is " +
              ranking
                .map(
                  (p) =>
                    p.short + " " + (t5[p.id] ?? 0) + " of " + sharedCount + " five-hour windows",
                )
                .join(" and ") +
              "."}
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <h4 className="m-0 font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                Price is not the lever
              </h4>
              <p className="m-0 text-[15px] font-light text-muted-foreground">
                Most shared models cost the same on every plan that carries them. The comparison is
                allowance, so the table shows the cheapest rate and puts the others underneath.
              </p>
              <div className="mt-auto border-t border-border pt-3.5 font-mono text-xs leading-relaxed text-muted-foreground">
                {sample && (
                  <>
                    <div className="text-foreground">{sample.name}</div>
                    <div>
                      {money(sample.plans[about.id]!.input)} in&nbsp;&nbsp;
                      {money(sample.plans[about.id]!.output)} out&nbsp;&nbsp;
                      {money(sample.plans[about.id]!.cacheRead)} cache read
                    </div>
                  </>
                )}
                <div className="mt-3.5 flex flex-wrap gap-0.5 rounded-lg border border-border p-3.5">
                  {pool.map((m) => (
                    <i
                      key={m.key}
                      className={"tick-cell " + (priceSplit(m, data).length ? "tick-cell-off" : "")}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block size-2.5 rounded-sm bg-tick" /> same on every plan
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block size-2.5 rounded-sm bg-bad" /> {splitModels.length}{" "}
                    differ
                  </span>
                </div>
                {splitModels.length > 0 && (
                  <div className="mt-2.5 font-sans text-muted-foreground">
                    {splitModels.map((m, i) => (i ? ", " : "") + m.name).join("")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <h4 className="m-0 font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                After a cap
              </h4>
              <p className="m-0 text-[15px] font-light text-muted-foreground">
                Go blocks unless balance fallback is on. Command Code bills pay-as-you-go credits at
                model cost. Free models keep working.
              </p>
              <div className="mt-auto border-t border-border pt-3.5 font-mono text-xs leading-relaxed text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  DeepSeek peak pricing, UTC
                  {/* What the strip shows and which clock it reads: the peak
                      windows are quoted in UTC, and the marker is the reader's
                      own hour, so the two never disagree about which window is
                      which. */}
                  <Tooltip>
                    <TooltipTrigger
                      render={<Info className="size-3.5 cursor-default text-muted-foreground/70" />}
                    />
                    <TooltipContent>
                      DeepSeek prices peak between 01:00 and 04:00 UTC and again between 06:00 and
                      10:00 UTC, on weekdays. The marker is your local hour, shown next to the UTC
                      one.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-3 flex gap-0.5 rounded-lg border border-border px-1 pb-1 pt-4">
                  {Array.from({ length: 24 }, (_, h) => (
                    <i
                      key={h}
                      suppressHydrationWarning
                      className={
                        "hour " +
                        (isPeak(h) ? "hour-peak" : h < 7 ? "hour-night" : "") +
                        (h === uh ? " hour-now" : "")
                      }
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex text-[10px] text-muted-foreground/70">
                  {["00", "06", "12", "18", "23"].map((t, i) => (
                    <span
                      key={t}
                      className={
                        "flex-1 " +
                        (i === 1 || i === 2 ? "text-center" : i === 3 ? "text-center" : "")
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block size-2.5 rounded-sm bg-goat" /> peak, weekdays
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: "var(--h-night)" }}
                    />{" "}
                    night
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: "var(--h-off)" }}
                    />{" "}
                    off peak
                  </span>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px]">
                  <i className="inline-block size-2 rounded-full bg-bad" />
                  You are here:{" "}
                  {/* UTC now, the reader's own clock, and the peak state are the
                      three figures the server cannot know. Each sits in its own
                      flagged span so the structure is identical on both sides
                      and only the text moves. */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <b
                          className="flex cursor-default items-center gap-1 font-semibold text-foreground"
                          suppressHydrationWarning
                        />
                      }
                    >
                      {pad2(uh)}:{pad2(now.getUTCMinutes())} UTC
                    </TooltipTrigger>
                    <TooltipContent>
                      Your local time is {pad2(now.getHours() % 12 || 12)}:{pad2(now.getMinutes())}{" "}
                      {now.getHours() < 12 ? "AM" : "PM"} in {zoneCity()}. The windows above are
                      UTC, so your hour marks the same strip.
                    </TooltipContent>
                  </Tooltip>
                  <span suppressHydrationWarning>
                    {", " +
                      pad2(now.getHours() % 12 || 12) +
                      ":" +
                      pad2(now.getMinutes()) +
                      " " +
                      (now.getHours() < 12 ? "AM" : "PM") +
                      " in " +
                      zoneCity() +
                      ". DeepSeek is "}
                  </span>
                  <b className="font-semibold text-foreground" suppressHydrationWarning>
                    {isPeak(uh) ? "peak" : "off-peak"}
                  </b>
                  <span suppressHydrationWarning>
                    {" until " +
                      (nextBoundary(uh) > uh
                        ? pad2(nextBoundary(uh)) + ":00 UTC"
                        : "01:00 UTC tomorrow") +
                      "."}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
