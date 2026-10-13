// The page stepper's items: first page, last page, and either side of the
// current one. Anything skipped becomes one gap, so twelve pages never print
// twelve buttons. Each item carries a stable key, because a stepper rebuilt on
// every render must not use array positions for identity.

export interface PageItem {
  kind: "n" | "gap";
  n: number;
}

export const pageItems = (pages: number, cur: number): PageItem[] => {
  const keep = new Set([1, pages, cur - 1, cur, cur + 1]);
  const out: PageItem[] = [];
  for (let n = 1; n <= pages; n++) {
    if (keep.has(n)) out.push({ kind: "n", n });
    // The gap carries the first page it stands for, so its key is stable and
    // unique without reaching for the array position.
    else if (out.length && out[out.length - 1].kind === "n") out.push({ kind: "gap", n });
  }
  return out;
};
