// How the numbers are read: the rules shown rather than described. The window
// arithmetic is worked out on a real model, and each card carries a figure
// from this page's own data, so nothing here asserts something the reader
// cannot check against the tables above.
import { Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { comparable } from "@/lib/compare";
import { money, pad2 } from "@/lib/format";
import type { ModelRow, PlanData, PlanSide } from "@/lib/types";
import { zoneCity } from "@/lib/zone";

import { BrandMark } from "./brand-mark";
import { gsap, useGSAP } from "./motion";
import { ProviderLogo } from "./provider-logo";
import type { ViewState } from "./view";

/** The intro, scrubbed word by word. The keys count occurrences, so they are
 *  unique and derived from the text itself, and the server and the client
 *  split it identically. */
const SCRUB_TEXT =
  "Everything here comes from the vendor pages listed in the footer. Nothing is estimated unless it says so.";
const seen = new Map<string, number>();
const SCRUB_SPANS = SCRUB_TEXT.split(" ").map((w) => {
  const n = (seen.get(w) ?? 0) + 1;
  seen.set(w, n);
  return w + "." + n;
});
const SCRUB_WORDS = SCRUB_TEXT.split(" ").length;

/** DeepSeek peak windows are 01:00-04:00 and 06:00-10:00 UTC, so the state
 *  only changes on those four hours. */
const PEAK = [
  [1, 4],
  [6, 10],
] as const;
const isPeak = (h: number) => PEAK.some(([a, b]) => h >= a && h < b);
const EDGES = [1, 4, 6, 10];
const nextBoundary = (h: number) => EDGES.find((x) => x > h) ?? 1;

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
  const root = useRef<HTMLElement>(null);
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

  // The intro scrubs in one word at a time as the section crosses the
  // viewport: the claim is read at the speed of the scroll that proves it.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-word]",
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.06,
            scrollTrigger: {
              trigger: "[data-scrub]",
              start: "top 85%",
              end: "top 42%",
              scrub: true,
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="method"
      className="border-t border-border px-5 py-[clamp(64px,10vh,140px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        {/* The header lives on the same two columns as the cards below it, so
            its edges land on the card edges: the picker starts exactly where
            the right card starts, and the title block shares the left card's
            column. */}
        <div className="mb-[clamp(24px,4vh,40px)] grid items-end gap-x-4 gap-y-5 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
              How the numbers are read
            </h2>
            <p className="mt-3.5 max-w-[56ch] font-light text-muted-foreground" data-scrub>
              {SCRUB_TEXT.split(" ").map((w, i) => (
                <span key={SCRUB_SPANS[i]} data-word className="inline-block">
                  {w}
                  {i < SCRUB_WORDS - 1 ? "\u00a0" : ""}
                </span>
              ))}
            </p>
          </div>
          <div className="flex items-center gap-2.5 justify-self-start pb-1">
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

        {/* Two equal halves: the row stretches both cards to one height, and
            each card's last line sits on the bottom edge. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 pt-[22px]">
              <div className="flex flex-wrap items-center gap-3.5">
                {/* The model's own maker, from the same sprite the table uses:
                    the mark follows the picker, whatever it names. */}
                <ProviderLogo name={pick.name} size={24} />
                <h3 className="m-0 text-[clamp(20px,2.4vw,28px)] font-bold tracking-[-0.03em]">
                  {pick.name}
                </h3>
              </div>
            </div>

            {/* One panel per plan, stacked: the two halves split the card
                exactly, so no void opens between or under them. The plans
                render in the page's own order, so the second plan sits at the
                bottom of the card. */}
            <div className="grid flex-1 grid-rows-2 gap-px bg-border">
              {data.plans.map((p) => {
                const v = pick.plans[p.id];
                const isAbout = p.id === about.id;
                return (
                  <div
                    key={p.id}
                    className={
                      "flex flex-col justify-center gap-4 bg-card px-6 " +
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
                    <div className="grid grid-cols-3 gap-4">
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
          </div>

          <Card>
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
              <div>
                <h4 className="m-0 font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                  After a cap
                </h4>
                <p className="mt-2 mb-0 text-[15px] font-light text-muted-foreground">
                  Go blocks unless balance fallback is on. Command Code bills pay-as-you-go credits
                  at model cost. Free models keep working.
                </p>
              </div>

              <div className="mt-auto font-mono text-xs leading-relaxed text-muted-foreground">
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
                    <span key={t} className={"flex-1 " + (i > 0 && i < 4 ? "text-center" : "")}>
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
                {/* The reader's own hour, as a footer band: the marker dot, the
                    UTC figure with its hover label, the local time, and the
                    state that holds until the next window edge. */}
                <p className="mt-4 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border px-3.5 py-2.5 font-mono text-[12px]">
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
