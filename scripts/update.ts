// Fetches both provider docs, parses the per-model allowance tables with the
// shared parsers, merges them on a normalised model key, and writes
// src/data/plans.json for the Astro page to bake in.
//
// Run: bun scripts/update.mjs   (bun runs the TypeScript sources directly)

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mergeModels } from "../src/lib/merge.ts";
import { parseGoMarkdown, parseGoatHtml } from "../src/lib/parsers.ts";
import type { PlanCaps, PlanData, PlanMeta } from "../src/lib/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "data", "plans.json");

// The Go page lives under the V2 console docs now. There is no .md file to
// fetch: the same url answers markdown when the request asks for it, so the
// source link is the page and the read asks for markdown explicitly.
const OC_MD = "https://opencode.ai/v2/docs/console/go/";
const CC_URL = "https://commandcode.ai/docs/plans/goat";
// Xiaomi sends access-control-allow-origin on this page, so it is read directly and
// needs no reader or relay.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function get(url: string, accept?: string): Promise<string> {
  const headers: Record<string, string> = { "user-agent": BROWSER_UA };
  if (accept) headers.accept = accept;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const CC_5H = 14;
const CC_WEEK = 35;
const OC_5H = 0.2;
const OC_WEEK = 0.5;

async function main() {
  const [ocMd, ccHtml] = await Promise.all([get(OC_MD, "text/markdown"), get(CC_URL)]);

  const ocModels = parseGoMarkdown(ocMd);
  if (!ocModels.length) throw new Error("opencode: pricing table not found");
  const ccModels = parseGoatHtml(ccHtml);
  if (ccModels.length < 30) throw new Error(`commandcode: only ${ccModels.length} models parsed`);
  if (!ocModels.some((m) => m.reqMonth != null))
    throw new Error("opencode: request table not found");
  if (ccModels.filter((m) => m.reqMonth != null).length < 15) {
    throw new Error("commandcode: request table not found");
  }

  const caps: Record<string, PlanCaps> = {
    opencode: { fiveHourPct: OC_5H, weekPct: OC_WEEK },
    commandcode: { fiveHour: CC_5H, week: CC_WEEK },
  };
  const models = mergeModels(
    [
      ["opencode", ocModels],
      ["commandcode", ccModels],
    ],
    caps,
  );

  const dupes = models.length - new Set(models.map((m) => m.key)).size;
  if (dupes) throw new Error(`duplicate keys after merge: ${dupes}`);
  if (models.length < 40) throw new Error(`suspiciously few models: ${models.length}`);
  // Shared means carried by at least two plans, whatever those plans are.
  const shared = models.filter((m) => Object.values(m.plans).filter(Boolean).length >= 2);
  if (shared.length < 10) throw new Error(`suspiciously few shared models: ${shared.length}`);

  const plans: PlanMeta[] = [
    {
      id: "opencode",
      cls: "go",
      label: "OpenCode Go",
      short: "Go",
      price: 10,
      // The page answers markdown when the request asks for it, which is both
      // smaller and a far easier parse than the rendered HTML.
      src: OC_MD,
      fmt: "md",
      note: "Per-model limits. Five hours is 20% and a week is 50% of the model limit.",
    },
    {
      id: "commandcode",
      cls: "goat",
      label: "Command Code GOAT",
      short: "GOAT",
      price: 10,
      src: CC_URL,
      fmt: "html",
      note: "Flat $14 per five hours and $35 per week, held down by the model credit.",
    },
  ];

  const payload: PlanData = {
    fetchedAt: new Date().toISOString(),
    sources: { opencode: OC_MD, commandcode: CC_URL },
    plans,
    caps,
    models,
  };

  writeFileSync(OUT, JSON.stringify(payload) + "\n");

  console.log(
    `ok  models=${models.length}  shared=${shared.length}  ` +
      `opencode=${ocModels.length}  commandcode=${ccModels.length}  ` +
      `fetchedAt=${payload.fetchedAt}`,
  );
}

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
