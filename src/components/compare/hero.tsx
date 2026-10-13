// Hero: one statement, one sub line, one action. Everything with a figure in
// it lives in the section directly below, so the first viewport is the value
// proposition and the evidence starts the moment the reader scrolls.

import { ArrowDown } from "lucide-react";

export function Hero() {
  return (
    <section
      id="plans"
      className="px-5 pt-[clamp(44px,6vw,88px)] pb-[clamp(28px,4vw,48px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Open coding subscriptions
        </p>
        <h1 className="max-w-[30ch] text-[clamp(2.25rem,4.8vw,4.1rem)] font-bold leading-[1.04] tracking-[-0.04em]">
          Same price.{" "}
          <span className="font-light text-muted-foreground">Three very different months.</span>
        </h1>
        <p className="mt-6 max-w-[56ch] text-[clamp(16px,1.25vw,19px)] font-light text-muted-foreground">
          Token prices barely differ. What separates the plans is the cap, and one will not say what
          its is.
        </p>
        <div className="mt-8">
          {/* A link that looks like the primary button. Rendered as a plain
              anchor rather than a Button with a render prop so the label is on
              the element itself, which is what the a11y check and a screen
              reader both read. */}
          <a
            href="#models"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90 active:translate-y-px"
          >
            Compare every model <ArrowDown className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
