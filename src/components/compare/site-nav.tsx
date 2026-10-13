// Sticky nav: a minimal split bar. The brand sits left, the section links
// centre-left, the machine controls right. Each link carries a lucide glyph so
// the row reads as icons first and words second, and the labels step aside
// before the row ever needs a hamburger. Refresh is one click and reports
// through a toast, so there is no panel to open and nothing to dismiss. The
// change log is a dialog, not a section: the reader opens it when they wonder
// what moved, and it never takes a place in the page's argument.

import { Gauge, History, Moon, RefreshCw, Scale, Sigma, Sun, Table2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pad2 } from "@/lib/format";
import { zoneLabel } from "@/lib/zone";

// The change log left this row when it became a dialog, so the anchors name
// the four sections that remain.
const LINKS: { href: string; label: string; Icon: typeof Scale }[] = [
  { href: "#plans", label: "Plans", Icon: Scale },
  { href: "#limits", label: "Limits", Icon: Gauge },
  { href: "#models", label: "Models", Icon: Table2 },
  { href: "#method", label: "Method", Icon: Sigma },
];

const THEME_KEY = "plan-compare.theme";

export function SiteNav({
  refreshing,
  onRefresh,
  onOpenChanges,
  changesCount,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  onOpenChanges: () => void;
  changesCount: number;
}) {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const applyTheme = (next: boolean) => {
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* private mode */
    }
    setDark(next);
  };

  const zone = zoneLabel();

  const clock =
    pad2(now.getHours() % 12 || 12) +
    ":" +
    pad2(now.getMinutes()) +
    ":" +
    pad2(now.getSeconds()) +
    " " +
    (now.getHours() < 12 ? "AM" : "PM");

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center gap-3 px-5 md:gap-5 md:px-12">
        <a
          className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground no-underline"
          href="#top"
        >
          <Scale className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
          {/* The wordmark steps aside before it can truncate mid-word; the
              scale mark carries the brand at the narrowest width. */}
          <span className="hidden truncate sm:inline">What a coding plan gets you</span>
        </a>

        <nav className="ml-1 flex min-w-0 items-center gap-0.5" aria-label="Sections">
          {LINKS.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              // The glyph is the link at every width; the word joins it where
              // the row has room, so the bar never wraps to a second line.
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{label}</span>
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* The clock reads the machine, so the server cannot know what the
              client will say. Each volatile text sits in its own flagged span:
              the structure is identical on both sides, only the text moves. */}
          <div
            className="hidden flex-col items-end font-mono text-xs font-medium tabular-nums text-muted-foreground xl:flex"
            aria-hidden
          >
            <span className="text-foreground" suppressHydrationWarning>
              {clock}
            </span>
            <span className="text-[10.5px] tracking-wide" suppressHydrationWarning>
              {zone}
            </span>
          </div>
          {/* The theme is read before first paint (see the bootstrap script in
              the layout), so the server's guess cannot match. Both icons ship
              and CSS picks one, which keeps the markup identical. */}
          <Button
            variant="outline"
            size="icon"
            aria-pressed={dark}
            aria-label={dark ? "Dark mode on" : "Dark mode off"}
            title={dark ? "Dark mode on" : "Dark mode off"}
            onClick={() => applyTheme(!dark)}
            suppressHydrationWarning
            className="rounded-full"
          >
            <Sun className="dark:hidden" aria-hidden />
            <Moon className="hidden dark:block" aria-hidden />
          </Button>
          {/* What changed: an icon, not a nav item. The log is history, not
              part of the argument, so it lives behind a glyph with a hover
              label rather than holding a place in the row. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  id="changes-trigger"
                  variant="outline"
                  size="icon"
                  className="relative rounded-full"
                  onClick={onOpenChanges}
                />
              }
            >
              <History className="size-4" aria-hidden />
              <span className="sr-only">
                What changed{changesCount > 0 ? `, ${changesCount} entries` : ""}
              </span>
              {changesCount > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-go"
                  aria-hidden
                />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {changesCount > 0
                ? `What changed: ${changesCount} ${changesCount === 1 ? "entry" : "entries"} in the last 30 days`
                : "What changed: every refresh, dated"}
            </TooltipContent>
          </Tooltip>
          <Button
            id="refresh-trigger"
            onClick={onRefresh}
            disabled={refreshing}
            title="Read both vendor pages again and rebuild every figure"
            className="gap-2 rounded-full"
          >
            {refreshing ? <Spinner /> : <RefreshCw className="size-4" aria-hidden />}
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </div>
    </header>
  );
}
