// The compare app: one client island holding the page state. Every section is
// a pure function of (data, view, selected) plus a patch helper, so a control
// that changes the table cannot leave the verdict strip or the worked example
// describing a plan the reader is no longer looking at.

import { useCallback, useMemo, useState } from "react";

import { toast } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildLog, diffSnapshots, snapshotOf } from "@/lib/changelog";
import { runRefresh } from "@/lib/refresh";
import type { PlanData } from "@/lib/types";

import { ChangelogDialog } from "./changelog-dialog";
import { Hero } from "./hero";
import { LimitsSection } from "./limits-section";
import { MethodSection } from "./method-section";
import { ModelsSection } from "./models-table";
import { PlanCards } from "./plan-cards";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";
import { useHistory } from "./use-history";
import { initialView, type ViewState } from "./view";

/** What a refresh changed, said in one line: models read, figures moved,
 *  models joined or left. The numbers come from the same diff the changelog
 *  records, so the toast cannot claim something the log contradicts. */
const refreshSummary = (prev: PlanData, next: PlanData): string => {
  const labels = Object.fromEntries(next.plans.map((p) => [p.id, p.label]));
  const entries = diffSnapshots(snapshotOf(prev), snapshotOf(next), labels) ?? [];
  const moved = new Set(
    entries.filter((e) => e.kind !== "added" && e.kind !== "removed").map((e) => e.model),
  );
  const joined = entries.filter((e) => e.kind === "added").length;
  const left = entries.filter((e) => e.kind === "removed").length;
  const parts: string[] = [next.models.length + " models read"];
  if (moved.size)
    parts.push(moved.size + (moved.size === 1 ? " model updated" : " models updated"));
  if (joined) parts.push(joined + " joined");
  if (left) parts.push(left + " left");
  return parts.join(". ") + (parts.length === 1 ? ". Nothing moved." : ".");
};

export function CompareApp({ initialData }: { initialData: PlanData }) {
  const [data, setData] = useState<PlanData>(initialData);
  const [selected, setSelected] = useState<string>(() => initialData.plans[0]?.id ?? "");
  const [view, setView] = useState<ViewState>(initialView);
  const [refreshing, setRefreshing] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);

  // The dialog's entry count, so the nav icon can say what is inside it. The
  // same log the dialog renders, read here once for the badge.
  const history = useHistory(data);
  const changeCount = useMemo(() => {
    const labels = Object.fromEntries(data.plans.map((p) => [p.id, p.label]));
    return buildLog(history, snapshotOf(data), labels).length;
  }, [history, data]);

  const patch = useCallback((p: Partial<ViewState>) => {
    setView((v) => ({ ...v, ...p }));
  }, []);

  // How many models each plan carried in the last build. A refresh must come
  // back with at least this many per plan, or a half-read page would quietly
  // replace good figures with worse ones.
  const knownCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of data.plans) counts[p.id] = data.models.filter((m) => m.plans[p.id]).length;
    return counts;
  }, [data]);

  // One click, one toast that reports what happened. The toast is added once
  // and updated in place, so the progress and the result are the same message
  // rather than a stack that hides the previous one.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const before = data;
    const id = toast.add({
      title: "Reading both vendor pages",
      description: "Every figure on this page is rebuilt from what they answer.",
      type: "loading",
    });
    try {
      const result = await runRefresh(before, knownCounts, () => {});
      if (result.ok && result.data) {
        setData(result.data);
        toast.update(id, {
          title: "Figures updated",
          description: refreshSummary(before, result.data),
          type: "success",
        });
      } else if (result.refused) {
        toast.update(id, {
          title: "Refresh refused",
          description: "The reply did not parse cleanly, so the figures on screen were left alone.",
          type: "error",
        });
      } else {
        // Name the plan that failed and the reason, in one line. The remedy is
        // named only when every route was exhausted, because that is the only
        // case where the reader can act on it.
        const missed = result.steps
          .filter((s) => s.state === "failed")
          .map((s) => data.plans.find((p) => p.id === s.id)?.label ?? s.id);
        const exhausted = result.steps.every((s) => s.state === "failed");
        toast.update(id, {
          title: "Refresh failed",
          description:
            "Could not read " +
            missed.join(" or ") +
            ". The figures on screen were left alone." +
            (exhausted ? " Start the local read proxy: bun scripts/serve.mjs." : ""),
          type: "error",
        });
      }
    } catch (e) {
      toast.update(id, {
        title: "Refresh failed",
        description: e instanceof Error ? e.message : String(e),
        type: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }, [data, knownCounts]);

  return (
    // One provider inside the island, so every hover label on the page (the
    // nav's change log, the method's clock, the bars' legend) shares it.
    <TooltipProvider>
      <SiteNav
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenChanges={() => setChangesOpen(true)}
        changesCount={changeCount}
      />
      <main id="top" className="overflow-x-clip">
        <Hero />
        <PlanCards data={data} selected={selected} onSelect={setSelected} />
        <LimitsSection data={data} view={view} patch={patch} />
        <ModelsSection data={data} view={view} patch={patch} selected={selected} />
        <MethodSection data={data} view={view} patch={patch} selected={selected} />
      </main>
      <SiteFooter data={data} />
      <ChangelogDialog
        data={data}
        view={view}
        patch={patch}
        open={changesOpen}
        onOpenChange={setChangesOpen}
      />
    </TooltipProvider>
  );
}
