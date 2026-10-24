// Footer, shaped like one: the close carries the argument and its action,
// then three columns — the brand with the read's freshness at figure size,
// the page's own sections, and the vendor pages every figure was read from —
// and a bottom bar for the colophon. The stamp says how long ago the figures
// were read, because the page ships with figures baked in and a reader who
// never refreshes is looking at whatever the last build read.

import { ArrowDown, ArrowUpRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { ageText, whenLabel } from "@/lib/format";
import type { PlanData } from "@/lib/types";

import { BrandMark } from "./brand-mark";

const SECTIONS = [
  ["Plans", "#plans"],
  ["Limits", "#limits"],
  ["Models", "#models"],
  ["Method", "#method"],
] as const;

export function SiteFooter({ data }: { data: PlanData }) {
  // The age is recomputed on an interval, so a page left open overnight stops
  // claiming the figures are fresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const { hours, text } = ageText(data.fetchedAt);
  void tick;
  // The year is read once, not per render: an impure Date call in render
  // would roll over mid-year-night.
  const [year] = useState(() => new Date().getUTCFullYear());

  return (
    <footer className="border-t border-border px-5 pt-[clamp(64px,10vh,140px)] pb-10 md:px-12">
      <div className="mx-auto max-w-[1360px]">
        {/* The close: the page's argument, in one line, with the one action a
            reader can take. The button is high contrast in both modes and
            jumps to the table, which is where the argument is decided. */}
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8 pb-[clamp(48px,8vh,104px)]">
          <h2 className="m-0 max-w-[16em] text-[clamp(2.1rem,4.4vw,4.2rem)] leading-[1.04] font-bold tracking-[-0.035em]">
            Know what ten dollars{" "}
            <span className="font-light text-muted-foreground">actually buys.</span>
          </h2>
          <a
            href="#models"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 text-sm font-medium text-background no-underline transition-colors hover:bg-foreground/85 active:translate-y-px"
          >
            Compare every model
            <ArrowDown
              className="size-4 transition-transform group-hover:translate-y-0.5"
              aria-hidden
            />
          </a>
        </div>

        <div className="grid gap-x-12 gap-y-12 border-t border-border pt-[clamp(40px,7vh,72px)] md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0">
            <p className="flex items-center gap-2.5">
              <img src="/brand.webp" alt="" width={28} height={28} className="size-7 rounded-lg" />
              <span className="text-[17px] font-bold tracking-tight">Kodeverse</span>
            </p>
            <p className="mt-2.5 mb-0 max-w-[44ch] text-[14px] font-light text-muted-foreground">
              OpenCode Go and Command Code GOAT, compared model by model. Same price, different
              caps.
            </p>

            <p className="mt-9 mb-3 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
              The read
            </p>
            {/* The age is the one figure the server cannot know: it is
                measured from the reader's clock. The span is always rendered,
                so the structure matches on both sides and only the text moves. */}
            <p
              className="fig m-0 text-[clamp(22px,2.4vw,30px)] font-bold leading-none tracking-[-0.03em]"
              suppressHydrationWarning
            >
              {text}
            </p>
            {/* Same shape for the provenance sentence and the staleness
                warning: the spans always exist and the sentences appear once
                the figures are old enough to distrust. */}
            <p className="mb-0 mt-4 max-w-[52ch] text-[13px] leading-relaxed font-light text-muted-foreground">
              Read from the vendor pages <span suppressHydrationWarning>{text}</span>,{" "}
              <span suppressHydrationWarning>{whenLabel(data.fetchedAt)}</span> (
              {new Date(data.fetchedAt).toUTCString()}). {data.models.length} models from{" "}
              {data.plans.length} pages. Vendor figures change without notice; treat the plan pages
              as the contract.
              <span className="block" suppressHydrationWarning>
                {hours >= 6 && (
                  <>
                    A vendor may have changed since.{" "}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2"
                      onClick={() => document.getElementById("refresh-trigger")?.click()}
                    >
                      Refresh <ArrowDown className="size-3" aria-hidden />
                    </button>{" "}
                    to read every page again.
                  </>
                )}
              </span>
            </p>
          </div>

          <nav aria-label="Footer" className="min-w-0">
            <p className="mb-4 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
              On this page
            </p>
            <ul className="m-0 flex list-none flex-col p-0">
              {SECTIONS.map(([label, href]) => (
                <li key={href} className="border-b border-border/60 last:border-b-0">
                  <a
                    href={href}
                    className="group flex items-center justify-between py-3 text-[15px] font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
                  >
                    {label}
                    <ArrowUpRight
                      className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <p className="mb-4 font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
              Source pages
            </p>
            <ul className="m-0 flex list-none flex-col p-0">
              {data.plans.map((p) => (
                <li key={p.id} className="border-b border-border/60 last:border-b-0">
                  <a
                    href={p.src}
                    target="_blank"
                    rel="noopener"
                    className="group flex items-center gap-3 py-3 no-underline"
                  >
                    <BrandMark id={p.id as "opencode" | "commandcode"} small />
                    <span className="text-[15px] font-medium text-foreground">{p.label}</span>
                    <span className="fig ml-auto text-[11px] text-muted-foreground">
                      ${p.price}/mo
                    </span>
                    <ExternalLink
                      className="size-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mb-0 mt-4 max-w-[40ch] text-[12px] leading-relaxed font-light text-muted-foreground/80">
              Every figure on this page is read from these two pages, nothing estimated.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-6 text-[12px] text-muted-foreground">
          <span>© {year} KurutoDenzeru. All rights reserved.</span>
          <span className="fig" suppressHydrationWarning>
            Last read {whenLabel(data.fetchedAt)}
          </span>
        </div>
      </div>
    </footer>
  );
}
