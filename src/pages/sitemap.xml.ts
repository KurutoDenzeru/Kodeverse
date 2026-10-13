// sitemap.xml. One page, so one entry; lastmod is the read stamp of the baked
// figures, which is the only date this document genuinely has.

import plans from "../data/plans.json";

const SITE = import.meta.env.SITE ?? "";

export const prerender = true;

export function GET() {
  const modified = new Date(plans.fetchedAt).toISOString();
  const loc = SITE ? new URL("/", SITE).href : "/";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${loc}</loc>
    <lastmod>${modified}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
