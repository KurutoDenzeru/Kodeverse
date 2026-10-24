// Limits, the way the vendor pages present it: one row per model, two stacked
// full-width bars for the two plans, the request estimate and the monthly
// usage as two stacked figures at the right. Every model both plans publish
// figures for is on the list, and the most generous rows come first, so the
// reader meets the best cases before the thin ones.
//
// The bars share one logarithmic scale across the whole catalogue, the way the
// reference list does: a linear scale would draw every capped model as a
// hairline next to the ones that are free.
//
// On a wide screen the rail holds with CSS sticky and the catalogue scrolls
// past it: the title, the plan key, and what each vendor claims about its own
// caps hold still while the evidence moves. The rows draw their bars as they
// arrive.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { comparable, ranks, reqOf } from "@/lib/compare";
import { money, reqText } from "@/lib/format";
import type { ModelRow, PlanData } from "@/lib/types";

import { BrandMark } from "./brand-mark";
import { gsap, useGSAP } from "./motion";
import { ProviderLogo } from "./provider-logo";

/** One bar per plan, 8px and square, the shape the reference list uses. The
 *  fill is the shadcn Progress indicator on a transparent track: a visible
 *  grey track behind a short fill only adds noise to a column of them, and the
 *  reference draws none. The data-bar hook lets the section draw the fill in. */
function Bar({ cls, width }: { cls: "go" | "goat"; width: number }) {
  return (
    <Progress value={width} className="h-2 w-full flex-none">
      <ProgressTrack className="h-2 rounded-none bg-transparent p-0">
        <ProgressIndicator
          data-bar
          className={"h-full rounded-none " + (cls === "goat" ? "bg-goat" : "bg-go")}
        />
      </ProgressTrack>
    </Progress>
  );
}

/** A stacked figure column: one line per plan, in the plan's order, so the two
 *  numbers on a row always belong to the same plan as the two bars. */
function Figures({ items }: { items: { id: string; text: string }[] }) {
  return (
    <>
      {items.map((it) => (
        <span key={it.id} className="fig block text-[12.5px] leading-snug tabular-nums">
          {it.text}
        </span>
      ))}
    </>
  );
}

/** What each vendor says about its own plan, one claim at a time. The marks
 *  overlap like portraits, the arrows move between claims, and the wording is
 *  each plan's own note from the baked data, not a paraphrase. */
function VendorNotes({ data }: { data: PlanData }) {
  const [i, setI] = useState(0);
  const p = data.plans[i % data.plans.length];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center">
        <span className="flex">
          {data.plans.map((q, qi) => (
            <span
              key={q.id}
              className={
                "-ml-1.5 flex size-7 items-center justify-center rounded-full border bg-card " +
                (qi === i ? "z-10 border-foreground/40" : "border-border")
              }
              aria-hidden
            >
              <BrandMark id={q.id as "opencode" | "commandcode"} small />
            </span>
          ))}
        </span>
        <span className="fig ml-auto text-[11px] font-medium text-muted-foreground">
          {(i % data.plans.length) + 1} / {data.plans.length}
        </span>
      </div>
      <blockquote
        key={p.id}
        className="mt-4 mb-0 animate-in fade-in slide-in-from-bottom-2 text-[15px] leading-relaxed font-light text-muted-foreground duration-500"
      >
        {p.note}
      </blockquote>
      <p className="mt-2 mb-0 text-[13px] font-semibold text-foreground">{p.label}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            "What " + data.plans[(i - 1 + data.plans.length) % data.plans.length].label + " says"
          }
          className="size-7 rounded-full"
          onClick={() => setI((n) => (n - 1 + data.plans.length) % data.plans.length)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={"What " + data.plans[(i + 1) % data.plans.length].label + " says"}
          className="size-7 rounded-full"
          onClick={() => setI((n) => (n + 1) % data.plans.length)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function LimitsSection({ data }: { data: PlanData }) {
  const root = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const ranking = data.plans.filter((p) => ranks(p.id, data));

  const rows = useMemo(() => {
    // Comparable only: a model one plan carries, or that neither plan publishes
    // a monthly figure for, has nothing to compare and stays out of the list.
    const out: { m: ModelRow; free: boolean; reqTop: number }[] = [];
    for (const m of comparable(data, "monthly")) {
      const reqTop = Math.max(...ranking.map((p) => reqOf(m, p.id, "five") ?? 0));
      out.push({ m, free: m.plans[ranking[0]?.id ?? ""]?.monthly === -1, reqTop });
    }
    // The most generous rows come first: the free models and the biggest
    // allowances are the ones worth seeing first, and the least generous
    // sink to the bottom of the list.
    return out.sort((a, b) =>
      a.free !== b.free
        ? a.free
          ? -1
          : 1
        : a.reqTop !== b.reqTop
          ? b.reqTop - a.reqTop
          : a.m.name.localeCompare(b.m.name),
    );
  }, [data, ranking]);

  // One log scale across the whole catalogue, so expanding the list does not
  // redraw the bars on top of it. The request estimate is the quantity drawn.
  const scale = useMemo(() => {
    const values = rows.filter((r) => !r.free && r.reqTop > 0).map((r) => r.reqTop);
    const lo = values.length ? Math.log10(Math.min(...values)) : 0;
    const hi = values.length ? Math.log10(Math.max(...values)) : 1;
    const width = (v: number) =>
      v < 0 ? 100 : hi <= lo ? 100 : Math.max(1.5, ((Math.log10(v) - lo) / (hi - lo)) * 100);
    const ticks: { label: string; at: number }[] = [];
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
      const at = ((e - lo) / (hi - lo)) * 100;
      if (at < 0 || at > 100) continue;
      const n = 10 ** e;
      ticks.push({ label: n >= 1000 ? n / 1000 + "K" : String(n), at });
    }
    return { width, ticks };
  }, [rows]);

  const shown = rows;

  // The bars draw in behind one matchMedia; motion is dropped when the reader
  // asks for none. The rail's hold is CSS sticky on a wide screen, so the pin
  // never fights the grid it lives in. Expanding the list re-draws its bars.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-bar]",
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            ease: "none",
            stagger: 0.05,
            scrollTrigger: {
              trigger: list.current,
              start: "top 88%",
              end: "bottom 72%",
              scrub: 0.5,
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
      id="limits"
      className="border-t border-border px-5 py-[clamp(64px,10vh,140px)] md:px-12"
    >
      <div className="mx-auto grid max-w-[1360px] gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="min-w-0">
          {/* The rail holds while the catalogue scrolls past it: the wrapper
              stretches to the row's full height, so the sticky block travels
              the whole list. */}
          <div className="lg:sticky lg:top-24">
            <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Limits
            </h2>
            <p className="mt-3.5 max-w-[44ch] font-light text-muted-foreground">
              Estimated requests per 5 hours and monthly usage across every model both plans publish
              figures for — {rows.length} right now — on one logarithmic scale.
            </p>

            {/* The plan key sits with the bars it names, the way the reference
                list puts it: two marks, two colours, nothing else. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              {ranking.map((p) => (
                <span key={p.id} className="flex items-center gap-2 text-[13px] font-medium">
                  <i
                    className={"inline-block size-2.5 " + (p.cls === "goat" ? "bg-goat" : "bg-go")}
                  />
                  {p.short}
                </span>
              ))}
            </div>

            <div className="mt-6">
              <VendorNotes data={data} />
            </div>
          </div>
        </div>

        <div
          ref={list}
          className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card"
        >
          {/* Column labels, once. They are labels, not a header row: no rules,
              no alignment contract, and the bars carry the plan identity. */}
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,2.1fr)_auto_auto] items-center gap-x-6 border-b border-border px-5 py-2.5 text-xs text-muted-foreground md:grid">
            <span>Model</span>
            <span className="flex items-center gap-1.5">
              Requests per 5 hours
              <Tooltip>
                <TooltipTrigger
                  render={<span className="fig cursor-default text-muted-foreground/70" />}
                >
                  log
                </TooltipTrigger>
                <TooltipContent>
                  Bar length is the request estimate on a logarithmic scale, so a capped model and a
                  free one are both visible.
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="text-right">Est. req / 5h</span>
            <span className="text-right">Monthly usage</span>
          </div>

          <ul className="m-0 list-none p-0">
            {shown.map(({ m }) => (
              <li
                key={m.key}
                className="group px-5 py-2 transition-colors duration-300 hover:bg-accent/30"
              >
                {/* One row: the name, then the bars, then the two figure
                    columns. Below md the row becomes two lines, the bars
                    taking the full width under the name. */}
                <div className="grid grid-cols-1 items-center gap-x-6 gap-y-1.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2.1fr)_auto_auto]">
                  <span className="flex items-center gap-2.5 font-medium">
                    <ProviderLogo name={m.name} />
                    {m.name}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    {ranking.map((p) => {
                      // One bar per plan. The width is the full scale for a
                      // free model and the log position of its request
                      // estimate otherwise.
                      const v = m.plans[p.id]!.monthly;
                      return (
                        <Bar
                          key={p.id}
                          cls={p.cls === "goat" ? "goat" : "go"}
                          width={
                            v === -1
                              ? 100
                              : scale.width(Math.max(reqOf(m, p.id, "five") ?? 0, 0.0001))
                          }
                        />
                      );
                    })}
                  </span>
                  <span className="text-right">
                    <Figures
                      items={ranking.map((p) => {
                        const v = reqOf(m, p.id, "five");
                        return {
                          id: p.id,
                          text: v == null ? "-" : v === -1 ? "\u221e" : reqText(v),
                        };
                      })}
                    />
                  </span>
                  <span className="text-right">
                    <Figures
                      items={ranking.map((p) => {
                        const v = m.plans[p.id]!.monthly;
                        return { id: p.id, text: v === -1 ? "\u221e" : money(v) };
                      })}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* The scale sits in the bar column's own line, so the ticks line up
              with the bars above them. */}
          <div className="hidden border-t border-border px-5 py-2.5 md:block">
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2.1fr)_auto_auto] gap-x-6">
              <span />
              <span className="relative block h-4">
                {scale.ticks.map((t) => (
                  <span
                    key={t.label}
                    className="fig absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground/70"
                    style={{ left: t.at + "%" }}
                  >
                    {t.label}
                  </span>
                ))}
              </span>
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
