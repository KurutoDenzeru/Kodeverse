// robots.txt as an endpoint, so the sitemap line carries the site's own url
// when SITE_URL is set. A static file cannot know that url at authoring time.

const SITE = import.meta.env.SITE ?? "";

export const prerender = true;

export function GET() {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    ...(SITE ? [`Sitemap: ${new URL("/sitemap.xml", SITE).href}`] : []),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
