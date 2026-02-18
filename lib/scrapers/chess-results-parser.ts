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

import type { PlayerRoundResult } from "@/lib/types/tournament";

/**
 * Parse a single crosstable cell like "13w1", "56b½", "  0  ", "BYE", "+:-", etc.
 * Returns a PlayerRoundResult (without the round field — caller adds it).
 */
export function parseCrosstableCell(
  cell: string,
  round: number
): PlayerRoundResult {
  const s = cell.trim();

  // Empty cell or unplayed
  if (!s) {
    return {
      round,
      opponentRank: null,
      color: null,
      score: 0,
      isForfeit: false,
      isBye: true,
    };
  }

  // BYE patterns
  if (/^bye$/i.test(s) || s === "***") {
    return {
      round,
      opponentRank: null,
      color: null,
      score: s === "***" ? 0 : 1,
      isForfeit: false,
      isBye: true,
    };
  }

  // Forfeit patterns: "+:-" (win by forfeit), "-:+" (loss by forfeit), "-:K" etc.
  if (/^\+[:\-]/.test(s) || /^-[:\+]/.test(s) || s === "+" || s === "-") {
    const isWin = s.startsWith("+");
    return {
      round,
      opponentRank: null,
      color: null,
      score: isWin ? 1 : 0,
      isForfeit: true,
      isBye: false,
    };
  }

  // Standard pattern: "56b1", "13w½", "30w0", "4b½"
  // Format: {opponentRank}{color:w|b}{result:1|0|½}
  const match = s.match(/^(\d+)\s*([wb])\s*([10½]|1\/2)$/i);
  if (match) {
    const opponentRank = parseInt(match[1], 10);
    const color = match[2].toLowerCase() as "w" | "b";
    let score: number;
    if (match[3] === "½" || match[3] === "1/2") {
      score = 0.5;
    } else {
      score = parseInt(match[3], 10);
    }
    return { round, opponentRank, color, score, isForfeit: false, isBye: false };
  }

  // Forfeit with opponent: "56b+" (win by forfeit vs opponent 56)
  const forfeitMatch = s.match(/^(\d+)\s*([wb])\s*([+\-])$/i);
  if (forfeitMatch) {
    const opponentRank = parseInt(forfeitMatch[1], 10);
    const color = forfeitMatch[2].toLowerCase() as "w" | "b";
    const score = forfeitMatch[3] === "+" ? 1 : 0;
    return { round, opponentRank, color, score, isForfeit: true, isBye: false };
  }

  // Fallback: try to extract just a number (opponent rank) with no result info
  return {
    round,
    opponentRank: null,
    color: null,
    score: 0,
    isForfeit: false,
    isBye: false,
  };
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}
