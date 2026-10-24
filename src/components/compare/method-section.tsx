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
import type { ModelRow, PlanData } from "@/lib/types";
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

/** The versus board reads one window across both plans. The gap names the
 *  winner and the margin: a figure the other plan does not publish stands
 *  alone, unlimited beats a number, and equal figures are even. */
type VersusGap =
  | { kind: "win"; winner: "opencode" | "commandcode"; text: string }
  | { kind: "open"; side: "opencode" | "commandcode"; text: string }
  | { kind: "tie"; text: string };

const versusGap = (left: number | null, right: number | null): VersusGap => {
  if (left == null && right == null) return { kind: "tie", text: "not published" };
  if (left == null) return { kind: "open", side: "commandcode", text: "Go does not publish" };
  if (right == null) return { kind: "open", side: "opencode", text: "GOAT does not publish" };
  if (left === -1 && right === -1) return { kind: "tie", text: "unlimited on both" };
  if (left === -1) return { kind: "win", winner: "opencode", text: "Go, unlimited" };
  if (right === -1) return { kind: "win", winner: "commandcode", text: "GOAT, unlimited" };
  const diff = Math.abs(left - right);
  if (diff <= 0) return { kind: "tie", text: "even" };
  return left > right
    ? { kind: "win", winner: "opencode", text: "Go by " + money(diff) }
    : { kind: "win", winner: "commandcode", text: "GOAT by " + money(diff) };
};

/** The winner takes its plan colour; the other side steps back to half ink. */
const versusTone = (gap: VersusGap, side: "opencode" | "commandcode"): string => {
  if (gap.kind === "tie") return "text-foreground";
  const leads = gap.kind === "win" ? gap.winner === side : gap.side === side;
  if (leads) return side === "opencode" ? "text-go" : "text-goat";
  return "text-muted-foreground/50";
};

/** The margin, said once under the window label, in the winner's colour. */
function VersusChip({ gap }: { gap: VersusGap }) {
  return (
    <span
      className={
        "fig inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium leading-tight " +
        (gap.kind === "win"
          ? gap.winner === "opencode"
            ? "border-go/40 bg-go/10 text-go"
            : "border-goat/40 bg-goat/10 text-goat"
          : "border-border text-muted-foreground")
      }
    >
      {gap.text}
    </span>
  );
}

export function MethodSection({
  data,
  view,
  patch,
}: {
  data: PlanData;
  view: ViewState;
  patch: (p: Partial<ViewState>) => void;
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
        // The day rises one hour at a time when the strip arrives.
        gsap.from("[data-clock] i", {
          scaleY: 0.35,
          opacity: 0,
          transformOrigin: "bottom center",
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.025,
          scrollTrigger: { trigger: "[data-clock]", start: "top 88%" },
        });
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
          {/* The picker sits at the far right, its edge on the right card's
              edge, and every option carries its model's own mark. */}
          <div className="flex items-center gap-2.5 justify-self-end pb-1">
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
                className="w-[300px] max-w-full"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ProviderLogo name={pick.name} size={15} />
                  <SelectValue className="text-sm first-letter:uppercase" />
                </span>
              </SelectTrigger>
              <SelectContent>
                {pool.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    <span className="flex items-center gap-2.5">
                      <ProviderLogo name={m.name} size={14} />
                      {m.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Two equal halves: the row stretches both cards to one height. */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* The worked example as a versus board: each plan owns one column,
              the model owns the middle, and every window reads across in one
              line with the gap named under it. */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 gap-y-2 px-6 pt-[22px] pb-5">
              <div className="flex items-center gap-2.5 justify-self-start">
                <BrandMark id="opencode" small />
                <span className="text-sm font-semibold text-go">OpenCode Go</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                {/* The model's own maker, from the same sprite the table uses:
                    the mark follows the picker, whatever it names. */}
                <ProviderLogo name={pick.name} size={30} />
                <h3 className="m-0 text-[clamp(17px,1.8vw,23px)] font-bold tracking-[-0.03em]">
                  {pick.name}
                </h3>
              </div>
              <div className="flex items-center gap-2.5 justify-self-end">
                <span className="text-sm font-semibold text-goat">Command Code GOAT</span>
                <BrandMark id="commandcode" small />
              </div>
            </div>

            <div className="grid flex-1 grid-rows-3 gap-px bg-border">
              {(["monthly", "five", "week"] as const).map((k) => {
                const left = pick.plans.opencode?.[k] ?? null;
                const right = pick.plans.commandcode?.[k] ?? null;
                const gap = versusGap(left, right);
                return (
                  <div
                    key={k}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 gap-y-1 bg-card px-6"
                  >
                    <p
                      className={
                        "fig m-0 justify-self-start text-[clamp(21px,2.2vw,28px)] font-bold leading-none tracking-[-0.03em] " +
                        versusTone(gap, "opencode")
                      }
                    >
                      {left == null ? (
                        <span className="text-[0.62em] font-medium text-muted-foreground/60">
                          not published
                        </span>
                      ) : (
                        money(left)
                      )}
                    </p>
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
                        {{ monthly: "Monthly", five: "Per 5 hours", week: "Per week" }[k]}
                      </span>
                      <VersusChip gap={gap} />
                    </div>
                    <p
                      className={
                        "fig m-0 justify-self-end text-[clamp(21px,2.2vw,28px)] font-bold leading-none tracking-[-0.03em] " +
                        versusTone(gap, "commandcode")
                      }
                    >
                      {right == null ? (
                        <span className="text-[0.62em] font-medium text-muted-foreground/60">
                          not published
                        </span>
                      ) : (
                        money(right)
                      )}
                    </p>
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

              <div className="mt-auto flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                    DeepSeek peak pricing, UTC
                  </span>
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

                {/* The day as one bare strip: tall segments, no box, and the
                    two peak windows bracketed above at their true hours. */}
                <div className="relative mt-5" data-clock>
                  {PEAK.map(([a, b]) => (
                    <span
                      key={a}
                      aria-hidden
                      className="absolute -top-2 h-0.5 rounded-full bg-goat/70"
                      style={{ left: (a / 24) * 100 + "%", width: ((b - a) / 24) * 100 + "%" }}
                    />
                  ))}
                  <div className="flex gap-[3px]">
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
                </div>

                {/* Boundary labels at true positions, 0 to 24. */}
                <div className="relative mt-2 h-4 font-mono text-[10px] text-muted-foreground/70">
                  {[
                    ["00", 0, ""],
                    ["06", 25, "-translate-x-1/2"],
                    ["12", 50, "-translate-x-1/2"],
                    ["18", 75, "-translate-x-1/2"],
                    ["24", 100, "-translate-x-full"],
                  ].map(([t, at, cls]) => (
                    <span key={t} className={"absolute top-0 " + cls} style={{ left: at + "%" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
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

                {/* The reader's own hour, as one borderless line: the marker
                    dot, the UTC figure at size with its hover label, the local
                    time, and the state that holds until the next window edge. */}
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
                  <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    <i className="inline-block size-1.5 rounded-full bg-bad" />
                    You are here
                  </span>
                  {/* UTC now, the reader's own clock, and the peak state are
                      the three figures the server cannot know. Each sits in
                      its own flagged span so the structure is identical on
                      both sides and only the text moves. */}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <b
                          className="fig cursor-default text-[19px] font-bold tracking-[-0.02em] text-foreground"
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
                  <span
                    className="text-[13px] font-light text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {pad2(now.getHours() % 12 || 12) +
                      ":" +
                      pad2(now.getMinutes()) +
                      " " +
                      (now.getHours() < 12 ? "AM" : "PM") +
                      " in " +
                      zoneCity()}
                  </span>
                  <span
                    className={
                      "fig rounded-full border px-2.5 py-1 text-[11px] font-medium " +
                      (isPeak(uh)
                        ? "border-goat/40 bg-goat/10 text-goat"
                        : "border-border text-muted-foreground")
                    }
                    suppressHydrationWarning
                  >
                    DeepSeek is <b className="font-semibold">{isPeak(uh) ? "peak" : "off-peak"}</b>{" "}
                    until{" "}
                    {nextBoundary(uh) > uh
                      ? pad2(nextBoundary(uh)) + ":00 UTC"
                      : "01:00 UTC tomorrow"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
