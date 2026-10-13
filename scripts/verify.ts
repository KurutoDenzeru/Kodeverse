// Gate for the reworked page. Run: bun scripts/verify.ts [--offline]
//
// The checks that survive the port, in order:
//   1. the baked data file is well formed and complete
//   2. the shared parsers read both vendor fixtures
//   3. a relay-prefixed body still parses whole (the truncation guard)
//   4. merge caps come from each plan's limits, and unlimited compares largest
//   5. the refresh guard refuses a table that lost a plan or a chunk
//   6. the changelog diffs figures, keeps the first snapshot of a day, prunes
//   7. serve.mjs is still the loopback-only allow-listed relay
//   8. scripts/serve.mjs serves dist, and the page names the way to refresh
//
// The DOM-stub tests the old index.html needed are gone with it: the page is
// now built components, proven by the build plus scripts/browser-smoke.mjs
// driving the real thing in a browser.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLog,
  diffSnapshots,
  pruneHistory,
  recordDay,
  snapshotOf,
  dayKey,
} from "../src/lib/changelog.ts";
import { comparable, gapOf, leader, tally, MAGNITUDE } from "../src/lib/compare.ts";
import { mergeModels, refreshAccepted } from "../src/lib/merge.ts";
import { count, money, normKey, parseGoMarkdown, parseGoatHtml } from "../src/lib/parsers.ts";
import type { PlanData } from "../src/lib/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(HERE, p), "utf8");

const failures: string[] = [];
const ok: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) ok.push(name);
  else failures.push(name + (detail ? " :: " + detail : ""));
}

// ---------- 1. the baked data ----------
const DATA: PlanData = JSON.parse(read("../src/data/plans.json"));
const PLAN_IDS = DATA.plans.map((p) => p.id);

check(
  "data parses",
  Array.isArray(DATA.models) && DATA.plans.length >= 2,
  DATA.models.length + " models",
);
check(
  "data carries a fetched stamp",
  typeof DATA.fetchedAt === "string" && Number.isFinite(Date.parse(DATA.fetchedAt)),
  DATA.fetchedAt,
);
check(
  "every model has a unique key",
  new Set(DATA.models.map((m) => m.key)).size === DATA.models.length,
  DATA.models.length - new Set(DATA.models.map((m) => m.key)).size + " dupes",
);
check(
  "data is a whole catalogue, not a fragment",
  DATA.models.length >= 40,
  DATA.models.length + " models",
);
const shared = comparable(DATA);
check("enough models are comparable", shared.length >= 10, shared.length + " comparable");
check(
  "every plan carries rows",
  PLAN_IDS.every((id) => DATA.models.some((m) => m.plans[id])),
);
check(
  "every plan states a cap rule",
  PLAN_IDS.every((id) => DATA.caps[id] != null),
);
check(
  "every plan names its source",
  DATA.plans.every((p) => p.src.startsWith("https:")),
);

// ---------- 2. the parsers read both vendor fixtures ----------
const OC_MD = read("../vendor/vendor-opencode.md");
const CC_HTML = read("../vendor/vendor-commandcode.html");

const ocModels = parseGoMarkdown(OC_MD);
const ccModels = parseGoatHtml(CC_HTML);
check("opencode fixture parses a whole table", ocModels.length >= 30, ocModels.length + " models");
check(
  "opencode fixture carries request estimates",
  ocModels.filter((m) => m.reqMonth != null).length >= 15,
  ocModels.filter((m) => m.reqMonth != null).length + " with requests",
);
check(
  "commandcode fixture parses a whole table",
  ccModels.length >= 30,
  ccModels.length + " models",
);
check(
  "commandcode fixture carries request estimates",
  ccModels.filter((m) => m.reqMonth != null).length >= 15,
  ccModels.filter((m) => m.reqMonth != null).length + " with requests",
);

// The cell readers: a price is a number, a promotion is left as wording, a
// request count drops its separators, and a model key survives the vendor's
// own formatting.
check(
  "money reads a price",
  money("$0.435") === 0.435 &&
    money("Free") === 0 &&
    money("Unlimited") === -1 &&
    money("-") === null,
  String(money("$0.435")),
);
check(
  "count reads a request estimate",
  count("1,234") === 1234 && count("Unlimited") === -1 && count("") == null,
  String(count("1,234")),
);
check(
  "a model key survives the vendor formatting",
  normKey("Tencent Hy4 preview") === "hy4" &&
    normKey("MiMo V2.6 Flash") === normKey("MiMo 2.6 Flash"),
  normKey("Tencent Hy4 preview"),
);

// The free models bill $0 and publish no credits row; they must survive as
// unlimited rather than vanish from the catalogue.
check(
  "free models are kept as unlimited",
  ccModels.some((m) => m.monthly === -1 && m.input === 0),
  "free rows: " + ccModels.filter((m) => m.monthly === -1 && m.input === 0).length,
);

// A promotion printed beside the plan's own rate stays a note, and the first
// figure stays the allowance.
const promoRow = ccModels.find((m) => m.promo);
check(
  "a promotion in the monthly cell is kept as a note",
  promoRow == null || (typeof promoRow.promo === "string" && promoRow.monthly != null),
  promoRow ? promoRow.name + " :: " + promoRow.promo : "no promo in fixture",
);

// ---------- 3. the relay prefix does not truncate the table ----------
// r.jina.ai prefixes what it returns with a four line header, and a reader that
// chokes on it would return a thinner catalogue. Feed exactly that shape.
const jinaOC =
  "Title: OpenCode Go\nURL: https://opencode.ai/v2/docs/console/go/\nPublished Time: 2026-10-13\nMarkdown Content:\n" +
  OC_MD;
check(
  "a relay-prefixed body parses to the same catalogue",
  parseGoMarkdown(jinaOC).length === ocModels.length,
  parseGoMarkdown(jinaOC).length + " vs " + ocModels.length,
);

// ---------- 4. merge caps ----------
const caps: Record<string, unknown> = {
  opencode: { fiveHourPct: 0.2, weekPct: 0.5 },
  commandcode: { fiveHour: 14, week: 35 },
};
const merged = mergeModels(
  [
    ["opencode", ocModels],
    ["commandcode", ccModels],
  ],
  caps as never,
);
check("merge keeps every model once", new Set(merged.map((m) => m.key)).size === merged.length);
check("merge is a whole catalogue", merged.length >= 40, merged.length + " rows");
const flatPlan = merged.find((m) => m.plans.commandcode && m.plans.commandcode!.monthly === 20);
check(
  "a flat cap is the smaller of the allowance and the cap",
  flatPlan != null && flatPlan.plans.commandcode!.five === Math.min(20, 14),
  flatPlan ? String(flatPlan.plans.commandcode!.five) : "no $20 row",
);
const derived = merged.find((m) => m.plans.opencode && m.plans.opencode!.monthly === 15);
check(
  "a derived cap is the model limit times the share",
  derived != null &&
    derived.plans.opencode!.five === 15 * 0.2 &&
    derived.plans.opencode!.week === 15 * 0.5,
  derived ? String(derived.plans.opencode!.five) : "no $15 row",
);
const unlimited = merged.find((m) => m.plans.commandcode && m.plans.commandcode!.monthly === -1);
check(
  "an unlimited allowance keeps unlimited caps",
  unlimited != null &&
    unlimited.plans.commandcode!.five === -1 &&
    unlimited.plans.commandcode!.week === -1,
);

// Unlimited must compare as the largest value there is, or a plan that
// publishes no cap would rank last and the capped plan would win.
check(
  "unlimited compares as the largest value",
  MAGNITUDE(-1) === Infinity && MAGNITUDE(-1) > MAGNITUDE(1e9),
);
const dataView = { ...DATA, models: merged } as PlanData;
const unlimRow = merged.find(
  (m) => m.plans.commandcode?.monthly === -1 && m.plans.opencode && m.plans.opencode.monthly! > 0,
);
if (unlimRow) {
  const l = leader(unlimRow, dataView, "monthly");
  check("the unlimited plan leads, not the capped one", l?.id === "commandcode", String(l?.id));
}

// The tally credits a lead to one plan and a level top to the tie, and never
// to a plan that publishes nothing for the field.
const tM = tally("monthly", dataView);
const credited =
  Object.keys(tM)
    .filter((k) => k !== "tie")
    .reduce((a, k) => a + tM[k], 0) + (tM.tie ?? 0);
check(
  "the tally credits every shared model exactly once",
  credited === shared.length,
  credited + " of " + shared.length,
);
check(
  "a level top is a tie, not a win",
  (() => {
    const level = merged.find(
      (m) =>
        m.plans.opencode &&
        m.plans.commandcode &&
        m.plans.opencode.monthly === m.plans.commandcode.monthly &&
        m.plans.opencode.monthly! > 0,
    );
    if (!level) return true; // no level pair in the fixture, nothing to assert
    const l = leader(level, dataView, "monthly");
    return l != null && l.id === null;
  })(),
);
check(
  "a gap is measured from the next figure, not from zero",
  (() => {
    const row = merged.find(
      (m) =>
        m.plans.opencode &&
        m.plans.commandcode &&
        m.plans.opencode.monthly! > 0 &&
        m.plans.commandcode.monthly! > 0 &&
        m.plans.opencode.monthly !== m.plans.commandcode.monthly,
    );
    if (!row) return true;
    const l = leader(row, dataView, "monthly");
    return l != null && l.id != null && gapOf(row, l) > 0;
  })(),
);

// ---------- 5. the refresh guard ----------
check("a whole table passes the guard", refreshAccepted(merged, PLAN_IDS));
check(
  "a table missing a plan is refused",
  !refreshAccepted(
    merged.filter((m) => !m.plans.commandcode),
    PLAN_IDS,
  ),
);
check("a thin table is refused", !refreshAccepted(merged.slice(0, 20), PLAN_IDS));
check(
  "a table with no shared model is refused",
  !refreshAccepted(
    merged.map((m) => {
      const first = PLAN_IDS.find((id) => m.plans[id]);
      const plans = Object.fromEntries(
        PLAN_IDS.map((id) => [id, id === first ? m.plans[id] : null]),
      );
      return { ...m, plans };
    }),
    PLAN_IDS,
  ),
);

// ---------- 6. the changelog ----------
const snapA = snapshotOf(DATA);
const moved: PlanData = JSON.parse(JSON.stringify(DATA));
const target = moved.models.find(
  (m) =>
    m.plans.commandcode && m.plans.commandcode.monthly != null && m.plans.commandcode.monthly > 0,
);
target!.plans.commandcode!.monthly = target!.plans.commandcode!.monthly! + 5;
const snapB = snapshotOf(moved);
const diff = diffSnapshots(
  snapA,
  snapB,
  Object.fromEntries(DATA.plans.map((p) => [p.id, p.label])),
);
check(
  "a moved allowance is one entry",
  diff != null && diff.length === 1 && diff[0].kind === "allowance",
  diff?.map((d) => d.text).join("; "),
);
check(
  "the entry names the plan and both figures",
  diff != null && diff[0].plan === "Command Code GOAT" && /\d/.test(diff[0].text),
  diff?.[0]?.plan,
);

const hist = recordDay({}, snapA);
check(
  "the first snapshot of a day is the baseline",
  Object.keys(hist).length === 1 && hist[dayKey(snapA.at)] === snapA,
);
const sameDay = recordDay(hist, snapB);
check(
  "a second snapshot the same day does not overwrite the baseline",
  sameDay[dayKey(snapA.at)] === snapA,
);
const log = buildLog(hist, snapB, Object.fromEntries(DATA.plans.map((p) => [p.id, p.label])));
check(
  "a live refresh the same day still reports the change",
  log.some((e) => e.kind === "allowance"),
);

const old = { "2026-01-01": snapA, [dayKey(snapA.at)]: snapB };
check("pruning drops days past the window", pruneHistory(old) && !("2026-01-01" in old));

// ---------- 7. serve.mjs ----------
const serve = read("serve.mjs");
check("serve.mjs exists", serve.length > 0);
check(
  "serve.mjs binds loopback only",
  // Quote-agnostic on purpose: the formatter chooses the quote style, and the
  // contract is the address, not the punctuation around it.
  /HOST\s*=\s*['"]127\.0\.0\.1['"]/.test(serve) && !/HOST\s*=\s*['"]0\.0\.0\.0['"]/.test(serve),
);
check("serve.mjs serves the build output", /dist/.test(serve));
check("serve.mjs serves the read route", /api\/raw/.test(serve));
for (const u of [
  "https://opencode.ai/v2/docs/console/go/",
  "https://commandcode.ai/docs/plans/goat",
]) {
  check("serve.mjs allows " + new URL(u).host, serve.includes(u));
}
check(
  "serve.mjs refuses a url outside the allow list",
  /ALLOWED\.has\([^)]*\)[\s\S]{0,120}403/.test(serve),
);

// ---------- 8. the page and the docs name the refresh route ----------
const html = read("../dist/index.html");
check("the build output exists", existsSync(join(HERE, "../dist/index.html")));
check(
  "the built page carries the baked figures",
  /fetchedAt/.test(html) && /OpenCode Go/.test(html),
);
check(
  "the built page carries the plan marks",
  /mark-oc/.test(html) && /mark-cc/.test(html) && /mark-ds/.test(html),
);
// The refresh panel renders on open, so its copy lives in the client bundle.
const jsChunks = readdirSync(join(HERE, "../dist/_astro")).filter((f) => f.endsWith(".js"));
const bundle = jsChunks.map((f) => readFileSync(join(HERE, "../dist/_astro", f), "utf8")).join("");
check(
  "the page names the local server as the way to refresh",
  bundle.includes("scripts/serve.mjs"),
);

// ---------- report ----------
console.log("PASS " + ok.length);
for (const n of ok) console.log("  ok   " + n);
if (failures.length) {
  console.log("FAIL " + failures.length);
  for (const f of failures) console.log("  FAIL " + f);
  process.exit(1);
}
console.log("FAIL 0");
