// Every model, every plan: the section the page is named for. One table, two
// comparison dimensions (allowance in dollars, or the vendors' own request
// estimates for a window), filterable, sortable, paged. The highlighted cell,
// the named winner, the sort order and the footer tally all read the one
// field the table is competing on, so a switch to the request view cannot
// leave the page naming an allowance winner in a table of request counts.

import { ArrowDown, ArrowUp, Minus, Search, SearchX, Tag } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  TOLERANCE,
  comparable,
  gapOf,
  leader,
  on,
  priceOf,
  priceSplit,
  ranks,
  reqOf,
  reqSum,
  tally,
  type Leader,
  type Window,
} from "@/lib/compare";
import { money, reqText } from "@/lib/format";
import type { ModelRow, PlanData, PlanMeta } from "@/lib/types";

import { NotPublished, WinnerBadge, planCls } from "./bits";
import { BrandMark } from "./brand-mark";
import { pageItems } from "./page-items";
import type { ViewState } from "./view";

const WINDOW_FIELD = { five: "req5h", week: "reqWeek", month: "reqMonth" } as const;
const WINDOW_LABEL = { five: "req / 5h", week: "req / wk", month: "req / mo" } as const;
const WINDOW_SHORT = { five: "5h", week: "week", month: "month" } as const;
const COMPARE_SLOTS = 3;
const RATE_FIELDS = ["input", "output", "cacheRead"] as const;

/** The plans the table puts side by side: three, not every plan, because four
 *  columns of figures is past what the eye can hold. The selected plan is
 *  always in the window, so the header and the cards name the same providers. */
const compareWindow = (data: PlanData, selected: string): PlanMeta[] => {
  const list = data.plans;
  if (list.length <= COMPARE_SLOTS) return list;
  const at = Math.max(
    0,
    list.findIndex((p) => p.id === selected),
  );
  const start = Math.max(0, Math.min(at - 1, list.length - COMPARE_SLOTS));
  return list.slice(start, start + COMPARE_SLOTS);
};

const scopeOptions = (): [string, string][] => [
  // The scope picker offers whole sets, never a single plan: a model only one
  // plan carries has nothing to compare, so it waits outside the table rather
  // than opening it with rows that cannot win or lose.
  ["shared", "Comparable models"],
  ["all", "Everything"],
  ["split", "Where the prices differ"],
];

interface Column {
  label: string;
  key: string | null;
  numeric: boolean;
  /** Dropped below md, where the card is too narrow to hold every column. The
   *  rates are detail; the winner column is a second read of the coloured
   *  cell beside it, and the verdict strip above states the tally anyway. */
  belowMd?: boolean;
}

const columns = (window_: PlanMeta[], view: ViewState, onRequests: boolean): Column[] => [
  { label: "Model", key: "name", numeric: false },
  { label: "In /1M", key: null, numeric: true, belowMd: true },
  { label: "Out /1M", key: null, numeric: true, belowMd: true },
  { label: "Cache read /1M", key: null, numeric: true, belowMd: true },
  ...window_.map((p) => ({
    label: onRequests ? p.short + " " + WINDOW_LABEL[view.win] : p.short + " monthly",
    key: onRequests ? p.id + "Req" : p.id,
    numeric: true,
  })),
  {
    label: onRequests ? "Winner, " + WINDOW_SHORT[view.win] : "Winner",
    key: "gap",
    numeric: false,
    belowMd: true,
  },
];

const competeText = (v: number, onRequests: boolean): string =>
  onRequests ? Number(v).toLocaleString("en-US") : "$" + v;

/** The winner cell names the leader for whatever the table is showing. A field
 *  the leader publishes no cap for has no gap, so the cell names the cap and
 *  stops, rather than measuring a distance from nothing. */
function winnerCell(m: ModelRow, l: Leader | null, data: PlanData, onRequests: boolean) {
  const short = (id: string) => data.plans.find((p) => p.id === id)?.short ?? id;
  if (!l)
    return <NotPublished>{onRequests ? "no published figures" : "no published caps"}</NotPublished>;
  if (l.top === -1) {
    const label = l.id ? short(l.id) + ", unlimited" : "Tie, unlimited";
    return <WinnerBadge label={label} id={l.id} glyph={l.id ? "check" : "minus"} data={data} />;
  }
  if (!l.id)
    return (
      <WinnerBadge
        label={"Tie at " + competeText(l.top, onRequests)}
        id={null}
        glyph="minus"
        data={data}
      />
    );
  return (
    <WinnerBadge
      label={short(l.id) + " by " + competeText(gapOf(m, l), onRequests)}
      id={l.id}
      glyph="check"
      data={data}
    />
  );
}

export function ModelsSection({
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
  const onRequests = view.dim === "requests";
  const compete = onRequests ? WINDOW_FIELD[view.win] : "monthly";
  // The footer totals the comparable set, the same set the rows come from, so
  // the totals can never describe a table the reader is not looking at.
  const pool = useMemo(() => comparable(data, compete), [data, compete]);
  const shown = compareWindow(data, selected);
  // The tally counts the field the table is competing on, so the tie count in
  // the request view is a count of request ties and not of allowance ties.
  const t = tally(compete, data);

  const list = useMemo(() => {
    const q = view.q;
    return data.models.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (view.scope === "split") return priceSplit(m, data).length > 0;
      // The comparable set follows the field on screen: allowance by default,
      // the window's request estimate once Requests is picked.
      if (view.scope === "shared") return comparable(data, compete).includes(m);
      return true;
    });
  }, [data, view.q, view.scope, compete]);

  const rows = useMemo(() => {
    const nm = (m: ModelRow) => m.name;
    const val: Record<string, (m: ModelRow) => number> = {
      name: (m) => nm(m).toLowerCase().charCodeAt(0),
      gap: (m) => gapOf(m, leader(m, data, compete)),
    };
    for (const p of data.plans) {
      val[p.id] = (m) => (m.plans[p.id] ? (m.plans[p.id]!.monthly ?? -1) : -1);
      val[p.id + "Req"] = (m) => {
        const r = reqOf(m, p.id, view.win);
        return r == null ? -1 : r === -1 ? Number.MAX_SAFE_INTEGER : r;
      };
    }
    const dir = view.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const f = val[view.sort] ?? val.gap;
      const x = f(a);
      const y = f(b);
      const primary = x === y ? 0 : x < y ? -1 : 1;
      return primary * dir || nm(a).localeCompare(nm(b));
    });
  }, [list, data, view.sort, view.dir, view.win, compete]);

  // The page is cut after the sort, so it is always a window on the whole
  // filtered set in the order the reader chose. The size tier of 0 means every
  // row, and a filtered set of nothing still has to divide by something.
  const per = view.size || rows.length || 1;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const page = Math.min(view.page, pages);
  const from = (page - 1) * per;
  const slice = rows.slice(from, from + per);

  const goPage = (n: number) => {
    patch({ page: n });
    document.getElementById("table-wrap")?.scrollIntoView({ block: "start" });
  };

  const sortBy = (key: string) => {
    if (view.sort === key) patch({ dir: view.dir === "asc" ? "desc" : "asc" });
    else patch({ sort: key, dir: key === "name" ? "asc" : "desc", page: 1 });
  };

  return (
    <section
      id="models"
      className="border-t border-border px-5 py-[clamp(60px,9vh,116px)] md:px-12"
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-[clamp(24px,4vh,40px)] max-w-[60ch]">
          <h2 className="m-0 text-[clamp(23px,3.1vw,36px)] font-bold leading-[1.1] tracking-[-0.03em]">
            Every model, every plan
          </h2>
          <p className="mt-3.5 max-w-[56ch] font-light text-muted-foreground">
            The badge names the winner. Pick one comparison at a time: allowance in dollars, or
            request estimates for a window.
          </p>
        </div>

        <div className="mb-[18px] flex flex-wrap items-center gap-x-[34px] gap-y-2.5 border-b border-border pb-[18px]">
          {data.plans.map((p) => (
            <span key={p.id} className="flex items-center gap-2.5">
              <BrandMark id={p.id as "opencode" | "commandcode"} small />
              <b className="text-sm font-semibold">{p.label}</b>
              <span className="fig text-xs text-muted-foreground">{p.short}</span>
            </span>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Filter models"
              placeholder="Filter models"
              value={view.q}
              onChange={(e) => patch({ q: e.target.value.trim().toLowerCase(), page: 1 })}
              className="w-[min(320px,100%)] pl-9"
            />
          </div>
          <span className="ml-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Show
          </span>
          <Select
            value={view.scope}
            onValueChange={(v) => patch({ scope: String(v), page: 1 })}
            items={Object.fromEntries(scopeOptions())}
          >
            <SelectTrigger aria-label="Filter by scope" className="min-w-[210px]">
              {/* The value is the selected option's own label, so it keeps its
                  capital and never renders smaller than the text beside it. */}
              <SelectValue className="text-sm first-letter:uppercase" />
            </SelectTrigger>
            <SelectContent>
              {scopeOptions().map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Compare
          </span>
          <Tabs
            value={view.dim}
            onValueChange={(v) => patch({ dim: v as ViewState["dim"], page: 1 })}
          >
            <TabsList aria-label="What to compare">
              <TabsTrigger value="allowance">Allowance</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>
          </Tabs>
          {onRequests && (
            <ToggleGroup
              value={[view.win]}
              onValueChange={(v) => {
                if (v[0]) patch({ win: v[0] as Window, page: 1 });
              }}
              aria-label="Request window"
            >
              {(["five", "week", "month"] as Window[]).map((w) => (
                <ToggleGroupItem key={w} value={w} size="sm">
                  {{ five: "5h", week: "Week", month: "Month" }[w]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <span className="fig ml-auto text-xs text-muted-foreground" data-testid="count">
            {rows.length} of {data.models.length} models
          </span>
        </div>

        <div
          id="table-wrap"
          className="rounded-xl border border-border bg-card"
          style={{ scrollMarginTop: "76px" }}
        >
          {/* table-fixed below md so the columns cannot push the card wider
              than the viewport: the widths become shares of the card instead
              of the content's demands. Above md the content sizes the table. */}
          <Table contain={false} className="table-fixed md:table-auto">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                {columns(shown, view, onRequests).map((c) => (
                  <TableHead
                    key={c.key ?? c.label}
                    scope="col"
                    aria-sort={
                      c.key === view.sort
                        ? view.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={
                      (c.numeric ? "text-right " : "") +
                      (c.key === "name" ? "w-[38%] " : "") +
                      (c.belowMd ? "hidden md:table-cell " : "")
                    }
                  >
                    {c.key ? (
                      <button
                        type="button"
                        className={
                          "flex w-full items-center gap-2 text-inherit " +
                          (c.numeric ? "justify-end" : "")
                        }
                        onClick={() => sortBy(c.key!)}
                      >
                        <span>{c.label}</span>
                        {c.key !== "name" && c.key !== "gap" && (
                          <BrandMark
                            id={c.key.replace(/Req$/, "") as "opencode" | "commandcode"}
                            small
                          />
                        )}
                        {view.sort === c.key &&
                          (view.dir === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ))}
                      </button>
                    ) : (
                      c.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((m) => {
                const l = leader(m, data, compete);
                const split = priceSplit(m, data);
                const carriers = on(m, data);
                return (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium whitespace-normal">
                      {m.name}
                      {carriers.length === 1 && (
                        <Badge variant="outline" className="ml-1.5 align-middle text-[10px]">
                          <Minus className="size-2.5" aria-hidden /> solo
                        </Badge>
                      )}
                      {split.length > 0 && (
                        <Badge variant="secondary" className="ml-1.5 align-middle text-[10px]">
                          <Tag className="size-2.5" aria-hidden /> prices differ
                        </Badge>
                      )}
                    </TableCell>
                    {RATE_FIELDS.map((f) => {
                      const cheap = priceOf(m, data, f);
                      const dearer = carriers.filter(
                        (id) =>
                          m.plans[id]?.[f] != null &&
                          cheap != null &&
                          m.plans[id]![f]! > cheap.v * TOLERANCE,
                      );
                      return (
                        <TableCell
                          key={f}
                          className="fig hidden text-right text-[13px] tabular-nums text-muted-foreground md:table-cell"
                        >
                          {cheap ? money(cheap.v) : "-"}
                          {dearer.length > 0 && (
                            <span className="mt-[3px] block text-[11px] leading-tight">
                              <i
                                className={
                                  "mr-1 inline-block size-2.5 rounded-sm align-middle " +
                                  (planCls(dearer[0], data) === "goat" ? "bg-goat" : "bg-go")
                                }
                              />
                              {money(m.plans[dearer[0]]![f])}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    {shown.map((p) => {
                      const wins = l != null && l.id === p.id;
                      const cls = planCls(p.id, data) === "goat" ? "text-goat" : "text-go";
                      if (onRequests) {
                        return (
                          <TableCell
                            key={p.id}
                            className={
                              "fig text-right text-[13px] tabular-nums " +
                              (wins ? "font-bold " + cls : "text-muted-foreground")
                            }
                          >
                            {reqText(reqOf(m, p.id, view.win))}
                          </TableCell>
                        );
                      }
                      const carried = !!m.plans[p.id];
                      const v = carried ? m.plans[p.id]!.monthly : null;
                      return (
                        <TableCell
                          key={p.id}
                          className={
                            "fig text-right text-sm tabular-nums " +
                            (wins ? "font-bold " + cls : "text-muted-foreground")
                          }
                        >
                          {!carried ? (
                            "-"
                          ) : v == null ? (
                            <NotPublished />
                          ) : (
                            <>
                              {money(v)}
                              {m.plans[p.id]!.promo && (
                                <span className="mt-[3px] block text-[10px] font-normal text-muted-foreground/70">
                                  {m.plans[p.id]!.promo}
                                </span>
                              )}
                            </>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="hidden text-right md:table-cell">
                      {winnerCell(m, l, data, onRequests)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-medium">
                  {onRequests ? "Requests, summed" : "Shared models won"}
                  <span className="mt-[5px] block font-mono text-[11px] font-normal text-muted-foreground/70">
                    across all {rows.length} shown
                  </span>
                </TableCell>
                {RATE_FIELDS.map((f) => (
                  <TableCell key={f} className="hidden md:table-cell" />
                ))}
                {shown.map((p) => (
                  <TableCell key={p.id} className="fig text-right tabular-nums">
                    {onRequests ? (
                      ranks(p.id, data) ? (
                        reqText(reqSum(p.id, view.win, pool))
                      ) : (
                        <NotPublished />
                      )
                    ) : ranks(p.id, data) ? (
                      <Badge variant="secondary">{t[p.id] ?? 0} won</Badge>
                    ) : (
                      <NotPublished />
                    )}
                  </TableCell>
                ))}
                <TableCell className="fig hidden text-right md:table-cell">
                  {t.tie ?? 0} tied
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {rows.length === 0 && (
          <Empty className="mt-3">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No model matches that filter.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-3">
          <span className="fig text-xs text-muted-foreground" aria-live="polite">
            {pages <= 1
              ? rows.length === 1
                ? "1 model"
                : rows.length + " models"
              : "Rows " + (from + 1) + " to " + (from + slice.length) + " of " + rows.length}
          </span>
          <ToggleGroup
            className="ml-auto"
            value={[String(view.size)]}
            onValueChange={(v) => {
              if (v[0]) patch({ size: Number(v[0]), page: 1 });
            }}
            aria-label="Rows per page"
          >
            {[25, 50, 100, 0].map((s) => (
              <ToggleGroupItem key={s} value={String(s)} size="sm">
                {s === 0 ? "All" : s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {pages > 1 && (
            <Pagination className="mx-0 w-auto justify-start">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#models"
                    aria-disabled={page <= 1}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      if (page > 1) goPage(page - 1);
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
                        href="#models"
                        isActive={item.n === page}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          goPage(item.n);
                        }}
                      >
                        {item.n}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#models"
                    aria-disabled={page >= pages}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      if (page < pages) goPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </section>
  );
}
