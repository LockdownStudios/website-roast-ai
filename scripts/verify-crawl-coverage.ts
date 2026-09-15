import { createServer } from "node:http";
import { once } from "node:events";
import { scrapeWebsite } from "../lib/scrape";

const pagePaths = [
  "/services/",
  "/about/",
  "/contact/",
  "/pricing/",
  "/projects/",
  "/reviews/",
  "/faq/",
  "/rooms/",
  "/shop/",
  "/support/",
  "/locations/",
  "/team/",
  "/services/tax-advisory/",
];

function page(title: string, body: string, links: Array<[string, string]> = []) {
  const repeatedBody = `${body} ${body} ${body}`;
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${body}"></head><body><main><h1>${title}</h1><h2>Useful details</h2><p>${repeatedBody}</p>${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" ")}</main></body></html>`;
}

async function main() {
  const server = createServer((request, response) => {
    const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
    response.setHeader("Content-Type", "text/html; charset=utf-8");

    if (path === "/robots.txt") {
      response.setHeader("Content-Type", "text/plain");
      response.end("User-agent: *\nAllow: /\nSitemap: /catalog-index.xml");
      return;
    }
    if (path === "/catalog-index.xml") {
      response.setHeader("Content-Type", "application/xml");
      response.end("<sitemapindex><sitemap><loc>nested-pages.xml</loc></sitemap></sitemapindex>");
      return;
    }
    if (path === "/nested-pages.xml") {
      response.setHeader("Content-Type", "application/xml");
      const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      response.end(`<urlset>${pagePaths.map((item) => `<url><loc>${origin}${item}</loc></url>`).join("")}</urlset>`);
      return;
    }
    if (path === "/contact/") {
      response.statusCode = 503;
      response.end("Temporarily unavailable");
      return;
    }
    if (path === "/") {
      response.end(
        page("Evidence Test Company", "Business consulting for South African companies with clear service information.", [
          ["/services/", "Services"],
          ["/about/", "About"],
        ]),
      );
      return;
    }
    if (path === "/services/") {
      response.end(
        page("Consulting Services", "Tax advisory and business consulting services with a free consultation.", [
          ["tax-advisory/", "Tax Advisory Service"],
        ]),
      );
      return;
    }
    if (path === "/services/tax-advisory/") {
      response.end(
        page("Tax Advisory", "SARS dispute resolution and tax compliance support. Book a consultation by phone."),
      );
      return;
    }

    response.end(page(path.replaceAll("/", " ").trim() || "Page", `Evidence for ${path} with verified reviews, contact details and clear next steps.`));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const scraped = await scrapeWebsite(`${origin}/`);
    const coverage = scraped.crawl?.coverage;
    if (!coverage) throw new Error("Crawl coverage metadata was not recorded.");
    if (coverage.selectionMode !== "representative_sample" || !coverage.truncated) {
      throw new Error("Large discovered site was not marked as a representative sample.");
    }
    if (coverage.discoveredPageCount <= coverage.reviewedPageCount) {
      throw new Error("Discovered and reviewed page counts do not expose the crawl cap.");
    }
    if (!scraped.crawl?.failures?.some((failure) => failure.url.endsWith("/contact/"))) {
      throw new Error("Failed selected page was not recorded with crawl evidence.");
    }

    const nestedUrl = `${origin}/services/tax-advisory/`;
    const nestedWasAccountedFor =
      scraped.crawl.visitedUrls.includes(nestedUrl) || coverage.skippedUrls.includes(nestedUrl);
    if (!nestedWasAccountedFor) {
      throw new Error("Second-level relative link was not discovered from the services page.");
    }

    const evidencePage = scraped.crawl.pages.find((item) => item.role === "services");
    if (
      !evidencePage?.contentSnippet ||
      !evidencePage.headings?.length ||
      !evidencePage.ctas?.length ||
      !evidencePage.discoveredFrom ||
      !evidencePage.extractionMode
    ) {
      throw new Error("Reviewed page did not preserve its page-level evidence.");
    }

    console.log(
      `Crawl coverage checks passed (${coverage.reviewedPageCount}/${coverage.discoveredPageCount} pages reviewed).`,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
