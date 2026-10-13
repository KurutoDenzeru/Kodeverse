// Limits, the way the vendor pages present it: one row per model, two stacked
// full-width bars for the two plans, the request estimate and the monthly
// usage as two stacked figures at the right. The most generous rows come
// first, because those are the ones worth seeing before the list is expanded,
// and the least generous sink to the bottom where the expander finds them.
//
// The bars share one logarithmic scale across the whole catalogue, the way the
// reference list does: a linear scale would draw every capped model as a
// hairline next to the ones that are free.
//
// A grid, not a table. The rows are a comparison, not a data set: no row
// headers, no sortable columns, no cell borders. One hairline above the header
// and one above the footer are the only rules, and the space between rows does
// the separating.

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { comparable, ranks, reqOf } from "@/lib/compare";
import { money, reqText } from "@/lib/format";
import type { ModelRow, PlanData } from "@/lib/types";

import type { ViewState } from "./view";

const LIM_SIZE = 10;

/** One bar per plan, 8px and square, the shape the reference list uses. The
 *  fill is the shadcn Progress indicator on a transparent track: a visible
 *  grey track behind a short fill only adds noise to a column of them, and the
 *  reference draws none. */
function Bar({ cls, width }: { cls: "go" | "goat"; width: number }) {
  return (
    <Progress value={width} className="h-2 w-full flex-none">
      <ProgressTrack className="h-2 rounded-none bg-transparent p-0">
        <ProgressIndicator
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
        <span key={it.id} className="fig block text-[12.5px] leading-relaxed tabular-nums">
          {it.text}
        </span>
      ))}
    </>
  );
}

export function LimitsSection({
  data,
  view,
  patch,
}: {
  data: PlanData;
  view: ViewState;
  patch: (p: Partial<ViewState>) => void;
}) {
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
    // allowances are the ones worth seeing before the list is expanded, and
    // the least generous sink to the bottom where the expander finds them.
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

  const shown = view.limAll ? rows : rows.slice(0, LIM_SIZE);

  return (
    <section id="limits" className="px-5 pb-[clamp(40px,6vw,72px)] md:px-12">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-[clamp(24px,4vh,40px)] flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[60ch]">
            <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Limits
            </h2>
            <p className="mt-3.5 max-w-[56ch] font-light text-muted-foreground">
              Estimated requests per 5 hours and monthly usage limits by model.
            </p>
          </div>
          {/* The plan key sits with the bars it names, the way the reference
              list puts it: two marks, two colours, nothing else. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {ranking.map((p) => (
              <span key={p.id} className="flex items-center gap-2 text-[13px] font-medium">
                <i
                  className={"inline-block size-2.5 " + (p.cls === "goat" ? "bg-goat" : "bg-go")}
                />
                {p.short}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
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
              <li key={m.key} className="px-5 py-3.5">
                {/* One row: the name, then the bars, then the two figure
                    columns. Below md the row becomes two lines, the bars
                    taking the full width under the name. */}
                <div className="grid grid-cols-1 items-center gap-x-6 gap-y-2.5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2.1fr)_auto_auto]">
                  <span className="font-medium">{m.name}</span>
                  <span className="flex flex-col gap-1">
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

          {rows.length > LIM_SIZE && (
            <div className="border-t border-border px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="font-medium"
                onClick={() => patch({ limAll: !view.limAll })}
              >
                {view.limAll ? "Show fewer models" : "View all " + rows.length + " models"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
