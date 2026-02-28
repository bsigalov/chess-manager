import { NextResponse } from "next/server";
import {
  CookieSession,
  scrapePlayerProfile,
  scrapePlayerRatingHistory,
  type RatingEntry,
} from "@/lib/scrapers/chess-org-il";
import { delay } from "@/lib/scrapers/chess-results-parser";
import { getCachedClubData, setCachedClubData, getCacheAge } from "@/lib/cache/club-cache";
import * as cheerio from "cheerio";

interface ClubPlayerData {
  israeliId: number;
  name: string;
  birthYear?: number;
  rating: number;
  fideRating?: number;
  ratingHistory: RatingEntry[];
}

interface ClubData {
  clubName: string;
  players: ClubPlayerData[];
  scrapedAt: string;
}

const SEARCH_PATH = "/Players/SearchPlayers.aspx";

async function scrapeClubMembers(
  session: CookieSession,
  clubId: string,
  delayMs: number
): Promise<{ israeliId: number; name: string; rating: number; clubName: string }[]> {
  let { html, viewState: vs } = await session.get(SEARCH_PATH);
  await delay(delayMs);

  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchLinkButton",
    "",
    vs
  ));
  await delay(delayMs);

  // Extract club name from dropdown
  const $adv = cheerio.load(html);
  const clubName = $adv(`#ctl00_ContentPlaceHolder1_ClubsDDL option[value="${clubId}"]`).text().trim()
    || `Club ${clubId}`;

  const extraFields: Record<string, string> = {
    "ctl00$ContentPlaceHolder1$AdvancedSearchButton": "חיפוש",
    "ctl00$ContentPlaceHolder1$ClubsDDL": clubId,
    "ctl00$ContentPlaceHolder1$MembershipStatusDDL": "בתוקף",
  };

  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchButton",
    "",
    vs,
    extraFields
  ));
  await delay(delayMs);

  const $ = cheerio.load(html);
  const members: { israeliId: number; name: string; rating: number; clubName: string }[] = [];

  const table = $("table[id*='GridView']").first();
  table.find("tr").each((rowIdx, row) => {
    if (rowIdx === 0) return;
    const cells = $(row).find("td");
    if (cells.length < 10) return;

    const getText = (idx: number) => $(cells.get(idx)!).text().trim();
    const idRaw = parseInt(getText(2).replace(/\D/g, ""), 10);
    if (!idRaw) return;

    const name = getText(1);
    const rating = parseInt(getText(9).replace(/\D/g, ""), 10) || 0;
    if (name && rating > 0) {
      members.push({ israeliId: idRaw, name, rating, clubName });
    }
  });

  return members;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedClubData<ClubData>(clubId);
    if (cached) {
      const ageMs = getCacheAge(clubId) ?? 0;
      const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
      return NextResponse.json({
        ...cached,
        fromCache: true,
        cacheAgeHours: ageHours,
      });
    }
  }

  try {
    const session = new CookieSession();
    const delayMs = 1500;

    console.log(`Scraping club ${clubId} members...`);
    const members = await scrapeClubMembers(session, clubId, delayMs);
    console.log(`Found ${members.length} active members`);

    if (members.length === 0) {
      return NextResponse.json(
        { error: "No active members found for this club" },
        { status: 404 }
      );
    }

    const clubName = members[0].clubName;
    const players: ClubPlayerData[] = [];

    for (const member of members) {
      try {
        console.log(`  Scraping ${member.name} (${member.israeliId})...`);
        const profileSession = new CookieSession();
        const profile = await scrapePlayerProfile(profileSession, member.israeliId);
        await delay(delayMs);

        const historySession = new CookieSession();
        const ratingHistory = await scrapePlayerRatingHistory(historySession, member.israeliId, delayMs);

        players.push({
          israeliId: member.israeliId,
          name: profile.name || member.name,
          birthYear: profile.birthYear,
          rating: profile.israeliRating || member.rating,
          fideRating: profile.fideRatingStandard,
          ratingHistory,
        });
      } catch (err) {
        console.warn(`  Failed to scrape ${member.name}: ${err}`);
        players.push({
          israeliId: member.israeliId,
          name: member.name,
          rating: member.rating,
          ratingHistory: [],
        });
      }
    }

    const data: ClubData = {
      clubName,
      players: players.sort((a, b) => b.rating - a.rating),
      scrapedAt: new Date().toISOString(),
    };

    setCachedClubData(clubId, data);
    return NextResponse.json({ ...data, fromCache: false });
  } catch (err) {
    console.error("Club scrape error:", err);
    return NextResponse.json(
      { error: `Failed to scrape club data: ${err}` },
      { status: 500 }
    );
  }
}
