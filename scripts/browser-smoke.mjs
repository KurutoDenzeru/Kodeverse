// Browser smoke for the built page. Run:
//   bun run build && bun run serve &     # or: node scripts/serve.mjs &
//   node scripts/browser-smoke.mjs
//
// The page is built components, so the proof that it works is the thing
// itself, driven in a real browser against the real local server: render,
// filter, both compare dimensions, paging, the theme toggle, and a live
// refresh through the read proxy. CORS is enforced by the browser and cannot
// be reproduced from node, which is the whole reason this exists.
//
// Uses the DevTools protocol over node's built in WebSocket, so there is no
// dependency to install. Brave on macOS; edit BRAVE for another browser.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const PORT = 9333;
const PAGE = "http://127.0.0.1:8787/";
const WAIT_MS = 60000;

const failures = [];
const ok = [];
const check = (name, cond, detail = "") => {
  if (cond) ok.push(name);
  else failures.push(name + (detail ? " :: " + detail : ""));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("devtools never came up");
}

let id = 0;
function rpc(ws, method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    const on = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== msgId) return;
      ws.removeEventListener("message", on);
      if (m.error) reject(new Error(method + ": " + m.error.message));
      else resolve(m.result);
    };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

// The evaluate helper runs in the page and returns JSON. An async expression
// must return its own JSON string: wrapping a promise in JSON.stringify here
// would stringify the promise, not its value.
const evaluate = (ws, expression, isAsync = false) =>
  rpc(ws, "Runtime.evaluate", {
    expression: isAsync ? expression : `JSON.stringify(${expression})`,
    awaitPromise: true,
    returnByValue: true,
  }).then((r) => (r.result.value ? JSON.parse(r.result.value) : null));

const profile = mkdtempSync(join(tmpdir(), "cc-smoke-"));
const chrome = spawn(
  BRAVE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--window-size=1440,900",
    PAGE,
  ],
  { stdio: "ignore" },
);

const cleanup = () => {
  try {
    chrome.kill();
  } catch {}
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
};
process.on("exit", cleanup);

try {
  // The server is a separate process: say so plainly rather than timing out.
  const up = await fetch(PAGE)
    .then((r) => r.ok)
    .catch(() => false);
  if (!up) throw new Error("no server at " + PAGE + ". Run: node scripts/serve.mjs");

  const t = await target();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });

  const pageErrors = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails || {};
      pageErrors.push(
        (d.exception?.description || d.text || "exception").split("\n").slice(0, 2).join(" "),
      );
    }
  });
  await rpc(ws, "Runtime.enable");

  // Wait for the island to hydrate: the clock is repainted every second, so its
  // seconds changing is the signal that React is live.
  await sleep(2500);

  // ---- render ----
  const head = await evaluate(
    ws,
    `{
    title: document.title,
    h1: document.querySelector('h1')?.textContent,
    h2s: [...document.querySelectorAll('h2')].map((h) => h.textContent),
  }`,
  );
  check(
    "the page has its title",
    // The head owns the title now, so the check pins the exact string: a
    // rename in the layout without the smoke following it is a silent change
    // to every card and search result the page earns.
    head?.title === "What a ten-dollar coding plan gets you",
    head?.title,
  );
  check("the hero states the headline", /Same price/.test(head?.h1 || ""), head?.h1);
  check(
    // Four sections now: read, limits, models, method. The change log left the
    // page for a dialog, and the verdict strip became the three-window row.
    "every section is on the page",
    (head?.h2s?.length ?? 0) >= 3,
    (head?.h2s || []).join(" / "),
  );
  const resultGone = await evaluate(
    ws,
    `!document.querySelector('#result') && !document.querySelector('a[href="#result"]')`,
  );
  check("the who-wins-what section is gone", resultGone === true);
  const changesGone = await evaluate(
    ws,
    `!document.querySelector('#changes') && !document.querySelector('a[href="#changes"]') && !!document.getElementById('changes-trigger')`,
  );
  check("the change log is a nav dialog, not a section", changesGone === true);
  // The read row covers all three windows, so the hero answers 5h, week and
  // month without a scroll.
  const windows = await evaluate(
    ws,
    `[...document.querySelectorAll('#read h3')].map((h) => h.textContent.trim())`,
  );
  check(
    "the read row states all three windows",
    ["Per 5 hours", "Per week", "Per month"].every((w) => (windows || []).includes(w)),
    (windows || []).join(" / "),
  );

  const table = await evaluate(
    ws,
    `{
    count: document.querySelector('[data-testid="count"]')?.textContent,
    rows: document.querySelectorAll('#models tbody tr').length,
    cells: document.querySelectorAll('#models thead th').length,
    rectangular: [...document.querySelectorAll('#models tbody tr')].every((r) => r.children.length === document.querySelectorAll('#models thead th').length),
  }`,
  );
  const [shownN, totalN] = (table?.count || "")
    .match(/^(\d+) of (\d+) models$/)
    .slice(1)
    .map(Number);
  check("the table is rectangular", table?.rectangular === true, table?.cells + " columns");
  check(
    "the table opens on the comparable set",
    shownN < totalN && totalN >= 40 && shownN >= 10,
    table?.count,
  );
  // Everything is still one click away in the scope picker.
  await evaluate(ws, `document.querySelector('button[aria-label="Filter by scope"]')?.click()`);
  await sleep(300);
  await evaluate(
    ws,
    `[...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Everything')?.click()`,
  );
  await sleep(300);
  const allCount = await evaluate(
    ws,
    `document.querySelector('[data-testid="count"]')?.textContent`,
  );
  check(
    "the whole catalogue is still reachable",
    (allCount || "").match(/^(\d+) of \1 models$/) != null,
    allCount,
  );
  check("the default page holds 25 rows", table?.rows === 25, table?.rows + " rows");

  // ---- filter ----
  // React tracks the input's value, so the field is written through the native
  // setter: assigning .value directly is invisible to React's change event.
  const SET_VALUE = `
    const setValue = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };`;
  await evaluate(
    ws,
    `(() => {
    ${SET_VALUE}
    const q = document.querySelector('input[type="search"]');
    setValue(q, 'qwen');
    return true;
  })()`,
  );
  await sleep(300);
  const filtered2 = await evaluate(
    ws,
    `{
    count: document.querySelector('[data-testid="count"]')?.textContent,
    first: document.querySelector('#models tbody tr td')?.textContent,
    rows: document.querySelectorAll('#models tbody tr').length,
  }`,
  );
  const f = (filtered2.count || "").match(/^(\d+) of (\d+) models$/);
  check(
    "a filter narrows the set",
    f != null && Number(f[1]) < Number(f[2]) && Number(f[1]) === filtered2.rows,
    filtered2.count,
  );
  check("the filter matches what it shows", /qwen/i.test(filtered2.first || ""), filtered2.first);

  // ---- compare dimension ----
  await evaluate(
    ws,
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Requests')?.click()`,
  );
  await sleep(300);
  const onReq = await evaluate(
    ws,
    `{
    heads: [...document.querySelectorAll('#models thead th')].map((t) => t.textContent.trim()),
    foot: document.querySelector('#models tfoot tr')?.textContent,
    hasWindowSeg: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Week'),
  }`,
  );
  check(
    "the requests view names its window",
    (onReq?.heads || []).some((h) => /req \/ 5h/.test(h)),
    (onReq?.heads || []).join(","),
  );
  check(
    "the requests footer sums requests",
    /Requests, summed/.test(onReq?.foot || ""),
    (onReq?.foot || "").slice(0, 60),
  );
  check("the window switch appears with requests", onReq?.hasWindowSeg === true);

  // ---- back to allowance, page size and paging ----
  await evaluate(
    ws,
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Allowance')?.click()`,
  );
  await sleep(300);
  await evaluate(
    ws,
    `(() => {
    ${SET_VALUE}
    const q = document.querySelector('input[type="search"]');
    setValue(q, '');
    return true;
  })()`,
  );
  await sleep(300);
  await evaluate(
    ws,
    `(() => {
    [...document.querySelectorAll('[aria-label="Rows per page"] button')].find((b) => b.textContent.trim() === 'All')?.click();
    return true;
  })()`,
  );
  await sleep(300);
  const allRows = await evaluate(ws, `document.querySelectorAll('#models tbody tr').length`);
  check("the All tier shows every row", allRows === Number(totalN), allRows + " of " + totalN);

  await evaluate(
    ws,
    `[...document.querySelectorAll('[aria-label="Rows per page"] button')].find((b) => b.textContent.trim() === '25')?.click()`,
  );
  await sleep(300);
  await evaluate(
    ws,
    `(() => {
    [...document.querySelectorAll("nav[aria-label='pagination'] a")].find((a) => a.textContent.trim() === '2')?.click();
    return true;
  })()`,
  );
  await sleep(400);
  const page2 = await evaluate(
    ws,
    `({
    range: [...document.querySelectorAll('[aria-live="polite"]')].map((n) => n.textContent)[0],
    rows: document.querySelectorAll('#models tbody tr').length,
  })`,
  );
  check(
    "page two is a different slice",
    /^Rows 26 to 50 of \d+$/.test(page2?.range || ""),
    page2?.range,
  );

  // ---- scope ----
  await evaluate(ws, `document.querySelector('button[aria-label="Filter by scope"]')?.click()`);
  await sleep(300);
  await evaluate(
    ws,
    `[...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Where the prices differ')?.click()`,
  );
  await sleep(300);
  const scoped = await evaluate(ws, `document.querySelector('[data-testid="count"]')?.textContent`);
  check(
    "the scope filter narrows to the split models",
    /^\d+ of \d+ models$/.test(scoped || "") && Number(scoped.split(" ")[0]) < totalN,
    scoped,
  );

  // ---- the wording of a figure nobody capped ----
  // A free model bills $0 and publishes no limit, which reads as unlimited and
  // never as a raw -1. The scope goes back to Everything first, or the split
  // filter hides a model no price differs on.
  await evaluate(ws, `document.querySelector('button[aria-label="Filter by scope"]')?.click()`);
  await sleep(300);
  await evaluate(
    ws,
    `[...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Everything')?.click()`,
  );
  await sleep(300);
  await evaluate(
    ws,
    `(() => {
    ${SET_VALUE}
    const q = document.querySelector('input[type="search"]');
    setValue(q, 'glyph');
    return true;
  })()`,
  );
  await sleep(300);
  const freeRow = await evaluate(
    ws,
    `document.querySelector('#models tbody tr')?.textContent?.replace(/\\s+/g, ' ') || ''`,
  );
  check(
    "an unlimited allowance reads as unlimited",
    /unlimited/.test(freeRow) && !/-1/.test(freeRow),
    freeRow.slice(0, 120),
  );
  await evaluate(
    ws,
    `(() => {
    ${SET_VALUE}
    const q = document.querySelector('input[type="search"]');
    setValue(q, '');
    return true;
  })()`,
  );
  await sleep(300);

  // ---- theme ----
  const theme = await evaluate(
    ws,
    `(() => {
    const before = document.documentElement.classList.contains('dark');
    document.querySelector('button[aria-label^="Dark mode"], button[aria-label^="Light mode"]')?.click();
    return { before, after: document.documentElement.classList.contains('dark') };
  })()`,
  );
  check("the theme toggle flips the mode", theme?.before !== theme?.after, JSON.stringify(theme));

  // ---- live refresh through the local read proxy ----
  // One click starts the read. The progress and the result are one toast that
  // updates in place, so there is no panel and nothing to dismiss.
  const stampBefore = await evaluate(
    ws,
    `[...document.querySelectorAll('footer p')].map((p) => p.textContent).find((t) => /Read from the vendor pages/.test(t)) || ''`,
  );
  await evaluate(ws, `document.getElementById('refresh-trigger')?.click()`);
  const refreshed = await evaluate(
    ws,
    `(async () => {
    const toast = () => [...document.querySelectorAll('[data-slot="toast"]')].map((t) => t.textContent).join(' ');
    const t0 = performance.now();
    while (performance.now() - t0 < ${WAIT_MS}) {
      await new Promise((r) => setTimeout(r, 100));
      if (/Figures updated|Refresh refused|Refresh failed/.test(toast())) break;
    }
    return JSON.stringify({ toast: toast(), ms: Math.round(performance.now() - t0) });
  })()`,
    true,
  );
  const stampAfter = await evaluate(
    ws,
    `[...document.querySelectorAll('footer p')].map((p) => p.textContent).find((t) => /Read from the vendor pages/.test(t)) || ''`,
  );
  check(
    "one click starts the refresh",
    /Reading both vendor pages|Figures updated/.test(refreshed?.toast || ""),
    (refreshed?.toast || "").slice(0, 120),
  );
  check(
    "the toast reports what was read",
    /Figures updated/.test(refreshed?.toast || "") &&
      /\d+ models read/.test(refreshed?.toast || ""),
    (refreshed?.toast || "").slice(0, 160),
  );
  check(
    "the refresh moved the stamp",
    stampAfter !== stampBefore && /less than an hour ago/.test(stampAfter),
    stampAfter.slice(0, 90),
  );
  check(
    "the refreshed page still renders the table",
    (await evaluate(ws, `document.querySelectorAll('#models tbody tr').length`)) > 0,
  );

  // ---- the changelog dialog records the day ----
  // The log left the page, so the smoke opens it the way a reader does: click
  // the nav icon, then read the dialog.
  await evaluate(ws, `document.getElementById('changes-trigger')?.click()`);
  await sleep(600);
  const log = await evaluate(
    ws,
    `(async () => {
    const read = () => {
      const dlg = document.querySelector('[data-slot="dialog-content"], [role="dialog"]');
      const text = dlg?.textContent || '';
      return {
        open: !!dlg,
        kept: (text.match(/(\\d+) days? kept/) || [])[0],
        empty: /Nothing changed|First run|No changes of this kind/.test(text),
      };
    };
    // The dialog paints its header first and its body a tick later, so wait
    // for the line the check reads rather than assuming it is there.
    const t0 = performance.now();
    let out = read();
    while (performance.now() - t0 < 10000 && out.open && !out.kept && !out.empty) {
      await new Promise((r) => setTimeout(r, 100));
      out = read();
    }
    return JSON.stringify(out);
  })()`,
    true,
  );
  check("the changelog dialog opens", log?.open === true);
  check(
    "the changelog keeps a day or says why not",
    /kept/.test(log?.kept || "") || log?.empty === true,
    log?.kept,
  );
  await evaluate(ws, `document.querySelector('[data-slot="dialog-close"]')?.click()`);
  await sleep(300);

  check(
    "the page logged no uncaught errors",
    pageErrors.length === 0,
    pageErrors.slice(0, 3).join(" | "),
  );

  console.log("PASS " + ok.length);
  for (const n of ok) console.log("  ok   " + n);
  if (failures.length) {
    console.log("FAIL " + failures.length);
    for (const f of failures) console.log("  FAIL " + f);
    process.exitCode = 1;
  } else {
    console.log("FAIL 0");
  }
  console.log("STAMP : " + stampAfter.slice(0, 120));
} catch (e) {
  console.error("SMOKE ERROR", e.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
