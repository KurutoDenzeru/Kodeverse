// The view state every section shares: filters, sort, paging, and which plan
// the page is currently about. One object, one patch helper, so a control in
// one section cannot drift from the same control rendered elsewhere.

import type { Window } from "@/lib/compare";

export interface ViewState {
  q: string;
  scope: string;
  sort: string;
  dir: "asc" | "desc";
  win: Window;
  dim: "allowance" | "requests";
  logKind: string;
  page: number;
  size: number;
  logPage: number;
  logSize: number;
  modelEx: string;
  limAll: boolean;
}

export const initialView: ViewState = {
  q: "",
  // The comparable set is the comparison: a model only one plan carries has
  // nothing to compare, so it waits in the scope picker rather than opening
  // the table with rows that cannot win or lose.
  scope: "shared",
  sort: "gap",
  dir: "desc",
  win: "five",
  dim: "allowance",
  logKind: "all",
  page: 1,
  size: 25,
  logPage: 1,
  logSize: 25,
  modelEx: "deepseek41flash",
  limAll: false,
};
