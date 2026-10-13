// Small shared pieces: plan swatch, winner badge, the bar used by the result
// section, and the money/request figure cells. One place, so the plan colour
// and the "not published" wording cannot drift between sections.

import { Check, Circle, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { reqText, money } from "@/lib/format";

/** The colour class for a plan id, read from the plan's own record. Hardcoding
 *  the ids meant a new provider silently inherited the first plan's tint. */
export const planCls = (id: string, data: { plans: { id: string; cls: string }[] }): string =>
  data.plans.find((p) => p.id === id)?.cls ?? "go";

export const planShort = (id: string, data: { plans: { id: string; short: string }[] }): string =>
  data.plans.find((p) => p.id === id)?.short ?? id;

export const planLabel = (id: string, data: { plans: { id: string; label: string }[] }): string =>
  data.plans.find((p) => p.id === id)?.label ?? id;

/** The winner badge. It names the plan and the margin, or says the figure is
 *  tied, or that the plans that carry the model publish nothing to compare. */
export function WinnerBadge({
  label,
  id,
  glyph,
  data,
}: {
  label: string;
  id: string | null;
  glyph: "check" | "minus" | "circle";
  data: { plans: { id: string; cls: string }[] };
}) {
  const cls = id ? planCls(id, data) : null;
  return (
    <Badge
      variant="outline"
      className={
        cls === "go"
          ? "border-go/40 bg-go/10 text-go"
          : cls === "goat"
            ? "border-goat/40 bg-goat/10 text-goat"
            : "text-muted-foreground"
      }
    >
      {glyph === "check" ? (
        <Check aria-hidden />
      ) : glyph === "minus" ? (
        <Minus aria-hidden />
      ) : (
        <Circle aria-hidden />
      )}
      {label}
    </Badge>
  );
}

/** A figure nobody published. Set in the muted tone and never in an accent,
 *  so an absence never reads as a value of zero. */
export function NotPublished({ children = "not published" }: { children?: string }) {
  return <span className="fig text-[0.85em] font-medium text-muted-foreground">{children}</span>;
}

export { money, reqText };
