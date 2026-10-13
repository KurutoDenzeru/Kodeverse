// Local server for the built site and the vendor read proxy. Run:
//   node scripts/serve.mjs            (or: bun scripts/serve.mjs)
//
// Two jobs:
//   1. Serve dist/, the Astro build output, over http://127.0.0.1.
//   2. Expose /api/raw?url=<vendor url>, a loopback-only read relay.
//
// Why the relay exists: a page opened as a file has origin "null", and no
// public page will hand a "null" origin CORS headers it trusts. opencode.ai in
// particular sends no Access-Control-Allow-Origin at all, so a direct fetch
// from the browser is blocked no matter what. Served from http://127.0.0.1,
// the page can ask this server for the bytes instead, and the read is
// same-origin, so no CORS check applies and no third party is involved.
//
// Bound to the loopback interface on purpose. This is a read proxy: binding it
// to every interface would put an open relay on the network.

import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");
// Port from "--port 8787", from PORT=8787, or the default. All three are
// accepted so whichever form you already use keeps working.
const argvPort = process.argv.indexOf("--port");
const PORT = Number(argvPort > -1 ? process.argv[argvPort + 1] : process.env.PORT) || 8787;
const HOST = "127.0.0.1";
const UPSTREAM_MS = 20000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Only these are readable through /api/raw. Anything else is refused, so this
// cannot be used to reach a third party through the reader's machine.
const ALLOWED = new Set([
  "https://opencode.ai/v2/docs/console/go/",
  "https://commandcode.ai/docs/plans/goat",
]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
}

async function readUpstream(res, raw) {
  let target;
  try {
    target = new URL(raw);
  } catch {
    return send(res, 400, "Bad url parameter", { "content-type": "text/plain" });
  }
  if (!ALLOWED.has(target.href)) {
    return send(res, 403, "That url is not on the allow list", { "content-type": "text/plain" });
  }
  // The reader is on this machine and the browser origin is known, so echoing
  // it back is safe here. "*" would also do and is simpler to reason about.
  try {
    // The Go page answers markdown when asked, which is the shape the page
    // parses. Command Code publishes only HTML, so it is asked for html.
    const accept = target.hostname === "opencode.ai" ? "text/markdown" : "text/html, */*";
    const up = await fetch(target, {
      headers: { "user-agent": BROWSER_UA, accept },
      signal: AbortSignal.timeout(UPSTREAM_MS),
    });
    const body = await up.text();
    send(res, up.ok ? 200 : 502, body, {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*",
      "x-upstream-status": String(up.status),
    });
  } catch (e) {
    send(res, 502, (e && e.message) || "upstream failed", { "content-type": "text/plain" });
  }
}

const sendFile = (res, file) => {
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,OPTIONS",
    });
  }

  if (url.pathname === "/api/raw") return readUpstream(res, url.searchParams.get("url") || "");

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "method not allowed", { "content-type": "text/plain" });
  }

  if (!existsSync(DIST)) {
    return send(res, 503, 'No build yet. Run "bun run build" first.', {
      "content-type": "text/plain",
    });
  }

  // normalize plus the prefix check keeps "../" out of the served tree.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(DIST, rel === "/" || rel === "\\" ? "index.html" : rel);
  if (!file.startsWith(DIST)) {
    return send(res, 403, "forbidden", { "content-type": "text/plain" });
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error("directory");
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      return res.end();
    }
    sendFile(res, file);
  } catch {
    // A static export has no route fallback, so anything the build did not
    // emit is a miss. index.html is only re-served at the root, never for an
    // unknown path, so a stale link cannot silently render the whole app.
    send(res, 404, "not found", { "content-type": "text/plain" });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(
      "Port " + PORT + " is already taken. Close the other server, or start this one as:",
    );
    console.error("  node scripts/serve.mjs --port " + (PORT + 1));
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  console.log(
    "site       http://" + HOST + ":" + PORT + '/   (serving dist/, build with "bun run build")',
  );
  console.log("read proxy http://" + HOST + ":" + PORT + "/api/raw?url=<vendor url>");
  console.log("Refresh in the page uses the local proxy, so no public CORS relay is needed.");
});
