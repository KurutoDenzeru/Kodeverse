// Hero: the value proposition set wide, with the catalogue's makers carried
// inline in the headline and a marquee of provider marks under the fold line.
// Everything with a figure in it lives in the section directly below, so the
// first viewport states the question and the evidence starts on one scroll.

import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";

import { gsap, useGSAP } from "./motion";
import { PROVIDERS } from "./providers";

/** The makers named in the headline. Three marks, set in em so they scale
 *  with the text they sit inside. */
const INLINE = ["anthropic", "openai", "gemini"] as const;

function InlineMark({ id }: { id: string }) {
  return (
    <span
      aria-hidden
      className="mx-[0.08em] inline-flex size-[0.82em] translate-y-[0.06em] items-center justify-center rounded-full border border-border bg-card align-middle shadow-sm"
    >
      <svg className="size-[0.44em] text-foreground" focusable="false">
        <use href={`#p-${id}`} />
      </svg>
    </span>
  );
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-hero-rise]", {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.09,
          delay: 0.1,
        });
        // The composition drifts on its own; the scroll never has to own it.
        gsap.to("[data-hero-drift]", {
          y: -12,
          duration: 4.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      id="plans"
      className="relative px-5 pt-[clamp(56px,9vh,110px)] pb-[clamp(40px,6vh,80px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="grid items-center gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="min-w-0">
            <p
              data-hero-rise
              className="mb-7 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
            >
              OpenCode Go and Command Code GOAT, both $10 a month
            </p>
            <h1
              data-hero-rise
              className="max-w-[13em] text-[clamp(2.6rem,5.2vw,4.9rem)] leading-[1.04] font-bold tracking-[-0.035em]"
            >
              Same price.{" "}
              <span aria-hidden className="whitespace-nowrap">
                {INLINE.map((id) => (
                  <InlineMark key={id} id={id} />
                ))}
              </span>{" "}
              <span className="font-light text-muted-foreground">Three very different months.</span>
            </h1>
            <p
              data-hero-rise
              className="mt-7 max-w-[52ch] text-[clamp(16px,1.25vw,19px)] leading-relaxed font-light text-muted-foreground"
            >
              Sixty-four models read off the two vendor pages, every figure stamped with the date it
              was read. Token prices barely differ, so the comparison is the cap, and the five-hour
              cap is the number you actually meet.
            </p>
            <div data-hero-rise className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#models"
                className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background no-underline transition-colors hover:bg-foreground/85 active:translate-y-px"
              >
                Compare every model
                <ArrowDown
                  className="size-4 transition-transform group-hover:translate-y-0.5"
                  aria-hidden
                />
              </a>
              <a
                href="#method"
                className="group inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-6 text-sm font-medium text-foreground no-underline transition-colors hover:border-foreground/40 active:translate-y-px"
              >
                How the numbers are read
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </a>
            </div>
          </div>

          {/* The composition: a treated plate behind, the two plans and their
              makers riding in front. It overlaps the headline's corner on a
              wide screen and stacks under it everywhere else. */}
          <div data-hero-rise className="relative min-w-0 lg:-mt-16 lg:justify-self-end">
            <div data-hero-drift className="relative w-full max-w-[430px]">
              <div className="group overflow-hidden rounded-3xl border border-border shadow-2xl">
                <img
                  src="/hero.jpg"
                  alt="Server racks in a data center: the machines a ten-dollar plan rents by the hour"
                  width={1200}
                  height={1500}
                  loading="eager"
                  className="aspect-[4/5] w-full object-cover grayscale contrast-125 opacity-90 transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
              <div className="absolute -bottom-7 -left-6 rotate-[-3deg] rounded-2xl border border-border bg-card p-4 shadow-xl sm:-left-10">
                <p className="fig mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Both plans
                </p>
                <p className="fig text-2xl font-bold tracking-[-0.03em]">
                  $10<span className="text-sm font-medium text-muted-foreground">/mo</span>
                </p>
              </div>
              <div className="absolute -top-6 right-4 flex rotate-2 items-center gap-1.5 rounded-full border border-border bg-card p-2 pr-3.5 shadow-lg">
                {PROVIDERS.slice(0, 5).map((p) => (
                  <svg key={p.id} className="size-4 text-foreground" focusable="false">
                    <use href={`#p-${p.id}`} />
                  </svg>
                ))}
                <span className="fig text-[11px] font-medium text-muted-foreground">
                  +{PROVIDERS.length - 5}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* The catalogue's makers, in one continuous band. Duplicated once for
            the loop; the second copy is decoration and stays out of the a11y
            tree. */}
        <div
          data-hero-rise
          className="marquee mt-[clamp(48px,8vh,96px)] border-y border-border py-6"
        >
          <div className="marquee-track items-center gap-14 pr-14">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex items-center gap-14">
                {PROVIDERS.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <svg className="size-4" focusable="false">
                      <use href={`#p-${p.id}`} />
                    </svg>
                    {p.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
