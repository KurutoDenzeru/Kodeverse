// What changed: dated history instead of one replaceable baseline. Every
// refresh adds an entry for the day, and the browser keeps thirty days of
// them. Nothing leaves the machine.

import { Clock } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOG_META, buildLog, snapshotOf } from "@/lib/changelog";
import { whenLabel } from "@/lib/format";
import type { PlanData } from "@/lib/types";

import { BrandMark } from "./brand-mark";
import { pageItems } from "./page-items";
import { useHistory } from "./use-history";
import type { ViewState } from "./view";

const DAYS = 30;

export function ChangelogSection({
  data,
  view,
  patch,
}: {
  data: PlanData;
  view: ViewState;
  patch: (p: Partial<ViewState>) => void;
}) {
  // One snapshot per UTC day, kept for thirty days. The live figures are
  // compared against the most recent stored day, which is what makes a second
  // refresh on the same day still report what it changed.
  const history = useHistory(data);

  const labels = useMemo(() => Object.fromEntries(data.plans.map((p) => [p.id, p.label])), [data]);
  const all = useMemo(() => buildLog(history, snapshotOf(data), labels), [history, data, labels]);
  const shown = useMemo(
    () => (view.logKind === "all" ? all : all.filter((e) => e.kind === view.logKind)),
    [all, view.logKind],
  );
  const days = useMemo(() => Object.keys(history).sort(), [history]);

  const per = view.logSize || shown.length || 1;
  const pages = Math.max(1, Math.ceil(shown.length / per));
  const page = Math.min(view.logPage, pages);
  const from = (page - 1) * per;
  const slice = shown.slice(from, from + per);

  const kinds: [string, string][] = [
    ["all", "Everything"],
    ...Object.keys(LOG_META).map((k): [string, string] => [k, LOG_META[k].label]),
  ];

  return (
    <section
      id="changes"
      className="border-t border-border px-5 py-[clamp(60px,9vh,116px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-[clamp(24px,4vh,40px)] max-w-[60ch]">
          <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
            What changed
          </h2>
          <p className="mt-3.5 max-w-[56ch] font-light text-muted-foreground">
            Every refresh adds a dated entry. This browser keeps thirty days of them, and none of it
            leaves the machine.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-5 py-4">
            <span className="fig text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Show
            </span>
            <Select
              value={view.logKind}
              onValueChange={(v) => patch({ logKind: String(v), logPage: 1 })}
              items={Object.fromEntries(kinds)}
            >
              <SelectTrigger aria-label="Filter changes by kind" className="min-w-[180px]">
                <SelectValue className="text-sm first-letter:uppercase" />
              </SelectTrigger>
              <SelectContent>
                {kinds.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                    {value !== "all" && " (" + all.filter((e) => e.kind === value).length + ")"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="fig ml-auto text-xs text-muted-foreground">
              {days.length
                ? days.length +
                  (days.length === 1 ? " day" : " days") +
                  " kept, " +
                  DAYS +
                  " day window"
                : "nothing stored yet"}
            </span>
          </div>

          {days.length === 0 ? (
            <Empty className="border-0 py-11">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="font-normal">
                  First run in this browser, so there is nothing to compare against yet.
                  Today&rsquo;s figures are stored now. Press Refresh later and this section keeps a
                  dated entry for every day the vendors moved something.
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : shown.length === 0 ? (
            <Empty className="border-0 py-11">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="font-normal">
                  {all.length
                    ? "No changes of this kind in the window. Pick another filter to see the rest."
                    : "Nothing changed. Every model, allowance, price and request estimate matches the day before, across all " +
                      days.length +
                      (days.length === 1 ? " day" : " days") +
                      " stored."}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead scope="col">Kind</TableHead>
                  <TableHead scope="col">Model</TableHead>
                  <TableHead scope="col">Plan</TableHead>
                  <TableHead scope="col">Change</TableHead>
                  <TableHead scope="col">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((e) => {
                  const meta = LOG_META[e.kind] ?? LOG_META.price;
                  const plan = data.plans.find((p) => p.label === e.plan);
                  // The key is the entry itself: kind, model, plan, field and
                  // moment together name one row, and no two rows share all five.
                  const key = [e.kind, e.model, e.plan, e.label ?? "", e.when].join("|");
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <Badge variant={meta.badge === "badge-secondary" ? "secondary" : "outline"}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal">{e.model}</TableCell>
                      <TableCell>
                        {plan ? (
                          <span className="flex items-center gap-2">
                            <BrandMark id={plan.id as "opencode" | "commandcode"} small />
                            {plan.short}
                          </span>
                        ) : (
                          e.plan
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {e.label && <span className="text-muted-foreground">{e.label} </span>}
                        <b className="font-semibold">{e.text}</b>
                      </TableCell>
                      <TableCell className="fig text-xs whitespace-nowrap text-muted-foreground">
                        <time dateTime={e.when} title={new Date(e.when).toUTCString()}>
                          {whenLabel(e.when)}
                        </time>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {shown.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 border-t border-border px-5 py-3">
              <span className="fig text-xs text-muted-foreground" aria-live="polite">
                {pages <= 1
                  ? shown.length === 1
                    ? "1 change"
                    : shown.length + " changes"
                  : "Rows " + (from + 1) + " to " + (from + slice.length) + " of " + shown.length}
              </span>
              {pages > 1 && (
                <Pagination className="mx-0 ml-auto w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#changes"
                        aria-disabled={page <= 1}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          patch({ logPage: Math.max(1, page - 1) });
                        }}
                      />
                    </PaginationItem>
                    {pageItems(pages, page).map((item) =>
                      item.kind === "gap" ? (
                        <PaginationItem key={"gap-" + item.n}>
                          <span className="flex size-9 items-center justify-center text-muted-foreground">
                            ...
                          </span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item.n}>
                          <PaginationLink
                            href="#changes"
                            isActive={item.n === page}
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              patch({ logPage: item.n });
                            }}
                          >
                            {item.n}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#changes"
                        aria-disabled={page >= pages}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          patch({ logPage: Math.min(pages, page + 1) });
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
