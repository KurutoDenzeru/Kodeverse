// Live refresh: re-read both vendor pages, parse them with the shared parsers,
// and rebuild the data. The read does not depend on any one server: a
// same-origin proxy is tried first when the page is served by
// scripts/serve.mjs, then public readers that work from any origin.

import { mergeModels, refreshAccepted } from "./merge";
import { parseGoMarkdown, parseGoatHtml, type VendorModelWithRequests } from "./parsers";
import type { PlanCaps, PlanData, PlanId } from "./types";

const SAME_ORIGIN = (): boolean => location.protocol === "http:" || location.protocol === "https:";

// Ways of getting a vendor page into this tab.
//
// The local read route must never be attempted from a file page: a relative
// "api/raw" there resolves to a file:// url, which fetch cannot request at
// all, and the browser reports that as a CORS failure, which reads like a
// vendor problem when it is the page asking itself for something.
const READERS: Record<string, (u: string) => string> = {
  // Served locally, so the read is same-origin and needs no CORS grant.
  local: (u) => "api/raw?url=" + encodeURIComponent(u),
  // Straight to the vendor, no third party in the loop.
  direct: (u) => u,
  // Reads any url as plain text and answers with an
  // Access-Control-Allow-Origin matching the request origin, null included.
  // That is the one thing opencode.ai cannot do for itself. It prefixes the
  // body with a four line header, which the markdown reader ignores.
  jina: (u) => "https://r.jina.ai/" + u,
  // Passes bytes through untouched, but answers 520 and 522 often enough to
  // be a fallback rather than a route to lean on.
  allorigins: (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
};
// Tried one after another, so a route that cannot work is never asked while a
// working one is still available. The same-origin proxy goes first when the
// page is served by scripts/serve.mjs, because that read involves no third
// party; after it, the routes that work from any origin.
//
// md is OpenCode's markdown. opencode.ai sends no Access-Control-Allow-Origin
// at all, so a direct read from a page is refused every single time. The
// reader service echoes the request origin back, so it can carry that source
// and goes first among the public routes. It prefixes the body with a four
// line header, which the markdown reader ignores.
//
// html is Command Code's page. It sends Access-Control-Allow-Origin, so the
// direct read is the good one and no third party is involved.
const routeOrder = (fmt: string): string[] =>
  fmt === "md" ? ["jina", "allorigins", "direct"] : ["direct", "allorigins", "jina"];
const PROXY_MS = 20000;
const RETRY_MS = 700;

const READER: Record<PlanId, (body: string) => VendorModelWithRequests[]> = {
  opencode: parseGoMarkdown,
  commandcode: parseGoatHtml,
};

// Only a blip is worth a second try. A refusal is not: the browser has
// already logged it, and asking again only logs it a second time. 429 is
// excluded on purpose, since asking a rate limited relay again immediately
// makes it worse.
const transient = (e: unknown): boolean => {
  const m = (e instanceof Error && e.message) || "";
  return /^HTTP 5\d\d/.test(m) || /abort|timeout/i.test(m);
};

async function ask(url: string, ms: number): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) {
      // A 404 on the local route means the server in front has no read proxy,
      // which is what `astro dev` answers. Saying so beats reporting "HTTP 404"
      // and leaving the reader to guess which server they are on.
      if (r.status === 404 && url.startsWith("api/raw")) {
        throw new Error("this server has no read proxy");
      }
      throw new Error("HTTP " + r.status);
    }
    const body = await r.text();
    if (body.length < 800) throw new Error("short reply");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const nap = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

/** Returns the first route that answers with a whole catalogue. A thin answer
 *  counts as a failed route, not a smaller table: a reader that returns half a
 *  page parses cleanly and would otherwise quietly replace good figures with
 *  worse ones. */
async function grab(
  url: string,
  fmt: string,
  parse: (body: string) => VendorModelWithRequests[],
  known: number,
): Promise<VendorModelWithRequests[]> {
  // The floor catches a half-read page, not a small catalogue: a plan that
  // genuinely carries few models has to be allowed to return few.
  const floor = known ? Math.max(1, Math.floor(known * 0.8)) : 3;
  const order = SAME_ORIGIN() ? ["local", ...routeOrder(fmt)] : routeOrder(fmt);
  const errors: string[] = [];
  for (const name of order) {
    const route = READERS[name];
    for (let attempt = 1; attempt <= 2; attempt++) {
      let body: string;
      try {
        body = await ask(route(url), PROXY_MS);
      } catch (e) {
        const why = (e instanceof Error && e.message) || "failed";
        if (attempt === 2 || SAME_ORIGIN() || !transient(e)) {
          errors.push(why);
          break;
        }
        await nap(RETRY_MS);
        continue;
      }
      let list: VendorModelWithRequests[];
      try {
        list = parse(body);
      } catch (e) {
        errors.push("parse failed: " + (e instanceof Error ? e.message : String(e)));
        break;
      }
      if (list.length < floor) {
        errors.push("only " + list.length + " of " + known + " models");
        break;
      }
      return list;
    }
  }
  throw new Error(errors[0] || "no route answered");
}

export interface RefreshStep {
  id: PlanId;
  state: "waiting" | "reading" | "done" | "failed";
  detail: string;
}

export interface RefreshResult {
  ok: boolean;
  data?: PlanData;
  /** One entry per plan, in plan order. */
  steps: RefreshStep[];
  /** True when every plan answered but the merged table was refused as thin. */
  refused?: boolean;
}

/** Re-reads every plan, merges, and returns the rebuilt data. Nothing is
 *  written to the caller's state here: the caller decides what a refusal
 *  means, and the old figures stay on screen until it has fresh ones. */
export async function runRefresh(
  current: PlanData,
  knownCounts: Record<string, number>,
  onStep: (steps: RefreshStep[]) => void,
): Promise<RefreshResult> {
  const steps: RefreshStep[] = current.plans.map((p) => ({
    id: p.id,
    state: "waiting",
    detail: "waiting",
  }));
  const paint = () => onStep(steps.map((s) => ({ ...s })));
  paint();

  const settled = await Promise.allSettled(
    current.plans.map(async (p, i) => {
      steps[i].state = "reading";
      paint();
      const list = await grab(p.src, p.fmt, READER[p.id], knownCounts[p.id] ?? 0);
      return { id: p.id, list };
    }),
  );

  const okCount = settled.filter((s) => s.status === "fulfilled").length;
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      steps[i].state = "done";
      steps[i].detail = "updated, " + res.value.list.length + " models";
    } else {
      steps[i].state = "failed";
      steps[i].detail = res.reason instanceof Error ? res.reason.message : "failed";
    }
  });
  paint();

  if (okCount !== settled.length) {
    return { ok: false, steps };
  }

  const byId: Record<string, VendorModelWithRequests[]> = {};
  for (const r of settled) if (r.status === "fulfilled") byId[r.value.id] = r.value.list;
  const models = mergeModels(
    current.plans.map((p): [string, VendorModelWithRequests[]] => [p.id, byId[p.id]]),
    current.caps as Record<string, PlanCaps>,
  );

  if (
    refreshAccepted(
      models,
      current.plans.map((p) => p.id),
    )
  ) {
    return {
      ok: true,
      steps,
      data: { ...current, fetchedAt: new Date().toISOString(), models },
    };
  }
  // A reply that lost a chunk is refused, not half-applied: the figures on
  // screen stay the ones the last build read.
  return { ok: false, refused: true, steps };
}
