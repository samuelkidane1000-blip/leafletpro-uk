// Builds feed.xml for guides.leafletprouk.com from the WordPress blog.
// Runs on GitHub Actions (Node 20+). No packages needed.

import { writeFile } from "node:fs/promises";

const SITE = "https://leafletprouk.com";
const GUIDES = "https://guides.leafletprouk.com";
const API = `${SITE}/wp-json/wp/v2/posts?per_page=12&_embed=1&orderby=date&order=desc`;
const OUTPUT = "feed.xml"; // saved in the repo root, served at /feed.xml

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const decode = (s = "") =>
  s
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "-")
    .replace(/&hellip;|&#8230;/g, "...")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&");

const stripHtml = (html = "") =>
  decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const res = await fetch(API, {
  headers: {
    "User-Agent": "LeafletProGuidesFeedBot/1.0 (+https://guides.leafletprouk.com)",
    Accept: "application/json"
  }
});

if (!res.ok) {
  throw new Error(`WordPress API returned ${res.status}. Feed NOT updated.`);
}

const posts = await res.json();

if (!Array.isArray(posts) || posts.length === 0) {
  throw new Error("No posts returned. Feed NOT updated.");
}

const items = posts
  .map(post => {
    const title = stripHtml(post.title?.rendered);
    const link = post.link;
    const date = new Date(post.date_gmt ? post.date_gmt + "Z" : post.date);
    const excerpt = stripHtml(post.excerpt?.rendered).slice(0, 220);
    const media = post._embedded?.["wp:featuredmedia"]?.[0];
    const image = media?.source_url || "";
    const category = post._embedded?.["wp:term"]?.[0]?.[0]?.name || "Guides";

    return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <category>${esc(category)}</category>
      <description>${esc(excerpt)}</description>${
        image
          ? `
      <enclosure url="${esc(image)}" type="image/jpeg" length="0" />
      <media:content url="${esc(image)}" medium="image" />`
          : ""
      }
    </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LeafletPro UK Blog</title>
    <link>${GUIDES}/</link>
    <atom:link href="${GUIDES}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Guides on leaflet distribution, flyer delivery and postcode targeting in London.</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

await writeFile(OUTPUT, xml, "utf8");
console.log(`Wrote ${OUTPUT} with ${posts.length} posts. Newest: ${posts[0].link}`);
