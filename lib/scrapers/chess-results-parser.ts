import * as cheerio from "cheerio";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseChessResultsTable(
  html: string,
  tableIndex = 0
): string[][] {
  const $ = cheerio.load(html);
  const tables = $("table.CRs1, table.CRs2, table[class^='CRs']");
  if (tables.length === 0) return [];
  const table = tables.eq(tableIndex);
  const rows: string[][] = [];
  table.find("tr").each((_, tr) => {
    const cells: string[] = [];
    $(tr)
      .find("td, th")
      .each((_, cell) => {
        cells.push($(cell).text().trim());
      });
    if (cells.length > 0) rows.push(cells);
  });
  return rows;
}

export function parseResult(resultStr: string): string | null {
  if (!resultStr) return null;
  const s = resultStr.trim();
  if (s.includes("1") && s.includes("0") && !s.includes("\u00bd")) {
    if (s.indexOf("1") < s.indexOf("0")) return "1-0";
    return "0-1";
  }
  if (s.includes("\u00bd")) return "1/2-1/2";
  if (s === "1" || s === "1.0") return "1-0";
  if (s === "0" || s === "0.0") return "0-1";
  if (s === "+" || s.includes("+:-")) return "1-0";
  if (s === "-" || s.includes("-:+")) return "0-1";
  return null;
}

export function parseTitle(str: string): string | null {
  const titles = [
    "GM",
    "IM",
    "FM",
    "CM",
    "WGM",
    "WIM",
    "WFM",
    "WCM",
    "NM",
  ];
  const s = str.trim();
  for (const t of titles) {
    if (s === t || s.startsWith(t + " ")) return t;
  }
  return null;
}

export function parseRating(str: string): number | null {
  const n = parseInt(str.trim(), 10);
  return isNaN(n) || n < 100 || n > 3500 ? null : n;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}
