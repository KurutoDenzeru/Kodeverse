// Footer: where the figures came from, how old they are, and the two source
// pages. The stamp says how long ago the figures were read, because the page
// ships with figures baked in and a reader who never refreshes is looking at
// whatever the last build read.

import { ArrowDown, Clock, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { ageText } from "@/lib/format";
import type { PlanData } from "@/lib/types";

import { BrandMark } from "./brand-mark";

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

  return (
    <footer className="border-t border-border px-5 pt-[clamp(64px,10vh,140px)] pb-[68px] md:px-12">
      <div className="mx-auto max-w-[1360px]">
        {/* The close: the page's argument, in one line, with the one action a
            reader can take. The button is high contrast in both modes and
            jumps to the table, which is where the argument is decided. */}
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8 pb-[clamp(40px,7vh,88px)]">
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

        <div className="grid gap-[clamp(28px,5vw,64px)] border-t border-border pt-[clamp(40px,7vh,80px)] md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="mb-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted-foreground">
              Every figure on this page is read from the pages on the right
            </p>
            <p className="mb-2 max-w-[62ch] font-mono text-[13px] leading-loose text-muted-foreground">
              <Clock className="mr-2 inline-block size-3.5 align-[-2px]" aria-hidden />
              Read from the vendor pages{" "}
              {/* The age is the one figure the server cannot know: it is measured
                from the reader's clock. The span is always rendered, so the
                structure matches on both sides and only the text moves. */}
              <span suppressHydrationWarning>{text}</span>
              {", " + new Date(data.fetchedAt).toUTCString()}. {data.models.length} models from{" "}
              {data.plans.length} pages.
              {/* Same shape for the staleness warning: the span always exists and
                the sentence appears once the figures are old enough to distrust.
                The page ships with figures baked in, so a reader who never
                refreshes is looking at whatever the last build read. */}
              <span className="ml-2 text-muted-foreground/70" suppressHydrationWarning>
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
            <p className="m-0 max-w-[62ch] text-[13px] font-light text-muted-foreground">
              Vendor figures change without notice. Treat the plan pages as the contract.
            </p>
          </div>
          <div className="flex min-w-[280px] flex-col gap-2.5">
            {data.plans.map((p) => (
              <Card key={p.id} className="transition-colors hover:border-foreground/30">
                <a
                  className="flex items-center gap-3 p-3 pr-4 no-underline"
                  href={p.src}
                  target="_blank"
                  rel="noopener"
                >
                  <span className="w-[22px]">
                    <BrandMark id={p.id as "opencode" | "commandcode"} />
                  </span>
                  <span className="mr-auto text-sm font-medium text-foreground">{p.label}</span>
                  <ExternalLink className="size-3.5 text-muted-foreground/70" aria-hidden />
                </a>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
