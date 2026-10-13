// Vendor page parsers. One isomorphic source used by scripts/update.mjs,
// the browser refresh path and scripts/verify.mjs, so a parse change cannot
// mean one thing at build time and another in the browser.
//
// Both vendors publish markdown or html tables; nothing here touches node or
// the DOM, so the same file runs in both.

/** One model row as a vendor page lists it, before the two plans are merged. */
export interface VendorModel {
  name: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** Monthly credit in dollars. -1 means unlimited, null means not published. */
  monthly: number | null;
  /** Wording left in the monthly cell after its figure is taken out. */
  promo?: string;
}

/** A vendor row with the vendor's own per-window request estimates attached. */
export interface VendorModelWithRequests extends VendorModel {
  req5h?: number | null;
  reqWeek?: number | null;
  reqMonth?: number | null;
}

/** One model row from the Command Code credits tables. */
export type GoatCreditsRow = VendorModel & { promo?: string };

// "$0.435" -> 0.435 ; "-" -> null ; "Free" -> 0 ; "Unlimited" -> -1
export const money = (raw: string | null | undefined): number | null => {
  if (raw == null) return null;
  const s = String(raw)
    .replace(/[*<>/]/g, "")
    .trim();
  if (!s || s === "-" || s === "\u2014") return null;
  if (/^unlimited/i.test(s)) return -1;
  if (/^free/i.test(s)) return 0;
  const m = s.match(/-?[\d.]+/);
  return m ? Number(m[0]) : null;
};

// A request count: "1,234" -> 1234 ; "Unlimited" -> -1
export const count = (raw: string | null | undefined): number | null => {
  if (raw == null) return null;
  const s = String(raw).replace(/[,*]/g, "").trim();
  if (/^unlimited$/i.test(s)) return -1;
  const n = s.match(/\d+/);
  return n ? Number(n[0]) : null;
};

export const stripTags = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function cells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<t[hd][\s\S]*?<\/t[hd]>/g)]
    .map((m) => stripTags(m[0]))
    .filter((c) => c !== "");
}

function rowsOf(html: string): string[][] {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => cells(m[0]));
}

// ---- OpenCode Go -----------------------------------------------------------
// Two markdown pipe tables inside the same tabs block: prices with the monthly
// limit, then estimated requests per window. Both are keyed by model name.
// The V2 page wraps each tier in a PlanTabs block, so the read stops at the
// Go Plus table to keep to the $10 Go tier this page tracks. The boundary is
// the next "| Model |" header, not a tag, so the read also survives a relay
// (r.jina.ai) that rewrites the markup and collapses the column padding.
function pipeTable(md: string, header: string): string[][] {
  const want = header.replace(/\s+/g, " ").trim();
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.replace(/\s+/g, " ").trim().startsWith(want));
  if (start < 0) return [];
  const out: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const s = lines[i].replace(/\s+/g, " ").trim();
    if (!s.startsWith("|")) continue;
    if (s.startsWith("| Model |")) break; // the next table's header row
    if (/^\|\s*-/.test(s)) continue; // separator row
    out.push(
      lines[i]
        .split("|")
        .slice(1, -1)
        .map((x) => x.trim()),
    );
  }
  return out;
}

export function parseGoMarkdown(md: string): VendorModelWithRequests[] {
  const priced = pipeTable(md, "| Model");
  if (!priced.length) throw new Error("pricing table not found");
  const requests = pipeTable(md, "| Model | Requests per 5 hours")
    .map((c) => ({
      name: stripTags(c[0]),
      req5h: count(c[1]),
      reqWeek: count(c[2]),
      reqMonth: count(c[3]),
    }))
    .filter((r) => r.name && r.reqMonth != null);
  const reqByKey = new Map(requests.map((r) => [normKey(r.name), r] as const));
  return priced
    .map((c) => ({
      name: stripTags(c[0]),
      input: money(c[1]),
      output: money(c[2]),
      cacheRead: money(c[3]),
      cacheWrite: money(c[4]),
      monthly: money(c[5]),
    }))
    .filter((m) => m.name && m.monthly != null)
    .map((m) => Object.assign(m, reqByKey.get(normKey(m.name)) || {}));
}

export function parseGoatHtml(html: string): VendorModelWithRequests[] {
  const rows = rowsOf(html);
  const out = new Map<string, GoatCreditsRow>();
  const requests: {
    name: string;
    req5h: number | null;
    reqWeek: number | null;
    reqMonth: number | null;
  }[] = [];
  let inCredits = false;
  let inCatalog = false;
  let inRequests = false;

  for (const r of rows) {
    if (r.length < 2) continue;
    const head = r.join(" ");
    if (/^Model\b/.test(head)) {
      inCredits = /Monthly credits/.test(head);
      inCatalog = head.endsWith("Caps");
      inRequests = /Requests \/ 5 hours/.test(head);
      continue;
    }
    if (!/^[\w]/.test(r[0])) continue;
    const name = r[0].replace(/\s*-\d+%$/, "").trim();

    if (inRequests && r.length >= 4) {
      const req = { name, req5h: count(r[1]), reqWeek: count(r[2]), reqMonth: count(r[3]) };
      if (req.reqMonth != null) requests.push(req);
    } else if (inCredits && r.length >= 6 && /\$\s*\d/.test(r[5])) {
      if (out.has(name)) continue; // core table is listed first, keep it
      // The monthly cell is sometimes a promotion rather than one figure, for
      // example "$20 $60 through Oct 7th". Demanding the cell be exactly "$N"
      // dropped the model entirely, taking its prices and its request
      // estimates with it. The first figure is the plan's own rate; the rest
      // of the wording is a promotion kept as a note.
      const promo = String(r[5])
        .replace(/\$\s*[\d.,]+/g, "")
        .replace(/[\s|]+/g, " ")
        .trim();
      out.set(name, {
        name,
        input: money(r[1]),
        output: money(r[2]),
        cacheRead: money(r[3]),
        cacheWrite: money(r[4]),
        monthly: money(r[5]),
        ...(promo ? { promo } : {}),
      });
    } else if (inCatalog && r[0].endsWith("Free") && r.slice(1).includes("Free")) {
      // The catalog's free models bill $0 per request, which the page shows as
      // unlimited monthly credit rather than as a missing figure. The vendor
      // prints a Free badge inside the model cell and prices the row "Free",
      // so both are required: a model merely named like a free tier, or a
      // paid row, is never read as one that costs nothing.
      const freeName = r[0].replace(/Free$/, "").trim();
      if (!out.has(freeName)) {
        out.set(freeName, {
          name: freeName,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: null,
          monthly: -1,
        });
      }
    }
  }
  const reqByKey = new Map(requests.map((r) => [normKey(r.name), r] as const));
  return [...out.values()].map((m) => Object.assign(m, reqByKey.get(normKey(m.name)) || {}));
}

export const normKey = (name: string): string => {
  const s = name
    .toLowerCase()
    .replace(/^tencent\s+/, "") // Command Code prefixes model names with the vendor
    .replace(/\(.*?\)/g, "") // "(Off-Peak)", "(latest)", "(exp)" and size tiers
    .replace(/-\d+%$/, "") // deal badges, e.g. "-98%"
    .replace(/preview\s*/g, "") // "Hy4 preview" vs "Tencent Hy4 Preview"
    .replace(/v(?=\d)/g, "") // "MiMo V2.6 Flash" vs "MiMo 2.6 Flash"
    .replace(/[^a-z0-9]/g, "");
  // No hand-written merges. Two models the vendors list separately, such as
  // DeepSeek V4 Flash Vision and its Exp variant, keep separate keys: the
  // normalisation strips formatting, never identity.
  return s;
};
