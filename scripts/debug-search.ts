import { CookieSession, extractViewState } from "../lib/scrapers/chess-org-il";
import * as cheerio from "cheerio";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const session = new CookieSession();
  const { html, viewState: vs } = await session.get("/Players/SearchPlayers.aspx");
  await sleep(1500);

  // Try search with correct field name
  const { html: html2 } = await session.doPostBack(
    "/Players/SearchPlayers.aspx",
    "ctl00$ContentPlaceHolder1$SearchButton",
    "",
    vs,
    { "ctl00$ContentPlaceHolder1$SearchNameBox": "סיגלוב" }
  );

  const $ = cheerio.load(html2);
  console.log("Tables found:", $("table").length);
  console.log("GridViews found:", $("table[id*='GridView']").length);

  // Player links
  $("a[href*='Player.aspx']").each((i, el) => {
    console.log(`  Link: ${$(el).text().trim()} -> ${$(el).attr("href")}`);
  });

  // Try to get table content
  $("table[id*='GridView'] tr").each((rowIdx, row) => {
    const cells = $(row).find("td, th");
    const texts = cells.map((_, c) => $(c).text().trim()).get();
    console.log(`Row ${rowIdx}: ${texts.join(" | ")}`);
  });

  // Check for any messages
  $("span, div").each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes("סיגלוב") || text.includes("תוצאות") || text.includes("נמצאו")) {
      console.log(`  Message: ${text.slice(0, 200)}`);
    }
  });
}

main().catch(console.error);
