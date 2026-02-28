# Chess Tournament Manager — Lessons Learned & Developer Guide

This document captures hard-won technical knowledge from building the first version. It's organized by topic, with each section using a Problem/Solution format. If you're rebuilding this project, read this before you start.

---

## 1. chess-results.com Scraping

### URL Structure

chess-results.com uses a specific URL format:
```
https://s{N}.chess-results.com/tnr{TOURNAMENT_ID}.aspx?lan=1&art={VIEW}&rd={ROUND}&zeilen=99999
```

**Problem:** A tournament only exists on one specific subdomain (s1, s2, s4, s8). Requests to the wrong subdomain return 404.

**Solution:** Parse the original URL to extract the exact subdomain and reuse it for all subsequent requests for that tournament.

---

**Problem:** Large tournaments paginate their HTML tables, showing only partial data.

**Solution:** Add `zeilen=99999` to every request URL. This forces the site to render all rows in a single page.

---

### Art Parameter (View Types)

The `art` parameter selects different views of tournament data:

| art | View | What It Contains |
|-----|------|-----------------|
| 0 | Player List | Initial seeding: rank, title, name, federation, rating, FIDE ID |
| 1 | Final Ranking | Standings: rank, starting number, title, name, federation, rating, club/city, points, tiebreaks |
| 2 | Pairings | Round pairings: board, white player, result, black player |
| 4 | Crosstable | NxN matrix: all head-to-head results |

---

### Parsing Player Titles

**Problem:** Title (GM, IM, FM, etc.) is always in its own separate `<td>` cell, not combined with the player name. For untitled players, the cell exists but is empty.

**Solution:** Check for known title strings (GM, IM, FM, CM, WGM, WIM, WFM, WCM, NM) in the cell. If empty, the player has no title. Never assume the name cell contains the title.

Known titles to check: `GM, IM, FM, CM, WGM, WIM, WFM, WCM, NM`

---

### Parsing Standings (art=1)

**Problem:** The Final Ranking view has a Club/City column that sits between the Rating and Points columns. It contains text strings (not numbers). If your parser just looks for "the column after rating," it will grab the club name instead of points.

**Solution:** After finding the rating column, skip forward through columns until you find a numeric value. Use a while-loop that checks `parseFloat(cell)` — the first numeric value after rating is the points column.

**Problem:** European decimal format uses comma as separator (e.g., "7,5" for 7.5 points).

**Solution:** Replace commas with dots before parsing: `cell.replace(",", ".")`

---

### Parsing Pairings (art=2)

**Problem:** There's no fixed column index for the result. Different tournaments have different column layouts.

**Solution:** Find the result column by scanning each cell for result patterns: `" - "`, `"½"`, `"+:-"`, `"-:+"`. The result cell divides the row into white player columns (before) and black player columns (after).

**Problem:** Pairings have a "No." column (starting rank number, e.g., 1-100) that looks like a points value when parsing.

**Solution:** Understand that starting rank numbers are integers typically ≤ 100, while points can be decimals. Use context: the No. column appears before the player name, not after.

---

### Parsing Crosstable (art=4)

Each cell in the crosstable encodes: opponent rank + color + result.

Examples:
- `"13w1"` = played opponent rank 13, had white, won (score 1)
- `"56b½"` = played opponent rank 56, had black, drew (score ½)

**Problem:** Cells can also contain special values — BYE, forfeit notations, or empty cells.

**Solution:** Regex pattern: `/^(\d+)\s*([wb])\s*([10½]|1\/2)$/i`

Special cases to handle:
- `"bye"` (case-insensitive) — BYE with 1 point
- `"***"` — forfeit BYE with 0 points
- `"+:-"` or `"+"` — forfeit win
- `"-:+"` or `"-"` — forfeit loss
- Empty cell — no game played

---

### Round Count Detection

**Problem:** The tournament info page often returns `rounds: 0`, even for tournaments with many rounds completed. This is because the info page doesn't reliably display round count.

**Solution:** Fetch the standings page (art=1) instead. Parse the heading which reads "Final Ranking after N Rounds" — extract N from that heading text. Alternatively, use the maximum number of games any player has played (from standings data) as a fallback round count.

---

### Multi-Tournament Pages

**Problem:** Some chess-results.com pages host multiple tournaments. They use an `SNode` parameter to distinguish between them.

**Solution:** If the original URL contains an SNode parameter, preserve it and forward it on every subsequent request for that tournament.

---

### Rate Limiting

**Problem:** Sending requests too quickly to chess-results.com can get your IP temporarily blocked.

**Solution:** Add a 2-second minimum delay between requests. Use a standard browser User-Agent header. Cache all responses to avoid repeating requests.

---

## 2. Israeli Chess Federation API (chess.org.il)

### Architecture

The Israeli federation website is built on ASP.NET WebForms. This is important because it means:
- All interactions are form POSTs with ViewState
- Session state is maintained via cookies
- Navigation between pages requires extracting and re-submitting hidden form fields

---

### ViewState Management

**Problem:** Every POST request requires `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, and `__EVENTVALIDATION` hidden fields from the previous page response. Missing these fields causes the server to reject the request.

**Solution:** Before making any POST:
1. GET the page (or use the previous response HTML)
2. Extract the three hidden field values from the HTML
3. Include them in your POST body

This means you need a stateful session that preserves cookies and ViewState across requests.

---

### Pagination Pattern

**Problem:** Data grids (player lists, tournament lists, game lists) are paginated using ASP.NET's `__doPostBack` mechanism. Page 2 requires: `__doPostBack("ctl00$ContentPlaceHolder1$GridViewName", "Page$2")`

**Solution:** For each paginated grid:
1. POST with `__EVENTTARGET` = the GridView control ID
2. POST with `__EVENTARGUMENT` = `"Page$N"` where N is the page number
3. Include current ViewState
4. Parse the response for new ViewState + data

---

### 250-Result Search Cap

**Problem:** Player search returns a maximum of 250 results with no pagination. If your search matches more than 250 players, you only get the first 250 with no indication that results were truncated.

**Solution:** Implement adaptive range splitting:
1. Search with a rating range (e.g., 0-3500)
2. If exactly 250 results returned, assume the results are capped
3. Split the range in half and search each sub-range separately
4. Recursively split until each range returns < 250 results
5. Merge and deduplicate results

Suggested initial ranges: [0-1399], [1400-1599], [1600-1799], [1800-1999], [2000-9999]

---

### Key Endpoints & Field Names

**Player Profile** — `/Players/Player.aspx?Id={israeliId}`
- Name: in the 2nd `<h2>` tag
- FIDE ID: extract from link to `ratings.fide.com/profile/(\d+)`
- Data fields are in Hebrew `<li>` items:
  - "מד כושר ישראלי" = Israeli rating
  - "צפוי" = Expected rating (in parentheses)
  - "FIDE סטנדרטי" or "FIDE רגיל" = FIDE standard rating
  - "FIDE מהיר" = FIDE rapid rating
  - "FIDE בזק" = FIDE blitz rating
  - "דרגה בינלאומית" = International title
  - "דרגה" = Israeli title
  - "שנת לידה" = Birth year
  - "תוקף" = Card validity date (DD/MM/YYYY)
  - "מועדון" = Club name
  - "דירוג בישראל" = Israeli ranking position

**Rating History** — Triggered by POSTing a button click on the player page
- Data is embedded in `<area title="DD/MM/YYYY NNNN">` tags inside an `<map>` element
- Parse with regex: `title.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{3,4})/)`
- Deduplicate by period, sort chronologically

**Player Games** — Paginated GridView
- Note: The ASP.NET control ID has a typo: `PLayerGamesGridView` (capital L)
- Columns: tournament(0), date(1), ratingUpdate(2), whitePlayer(3), whiteScore(4), "-"(5), blackScore(6), blackPlayer(7)
- Opponent rating is embedded in parentheses in the name field: "שם (1779)"

**Player Search** — `/Players/SearchPlayers.aspx`
- Rating range fields: `ctl00$ContentPlaceHolder1$RatingFromTB`, `ctl00$ContentPlaceHolder1$RatingUptoTB`
- Active players filter: `ctl00$ContentPlaceHolder1$MembershipStatusDDL = "בתוקף"`
- Player status: `ctl00$ContentPlaceHolder1$PlayerStatusDDL = "1"`

---

### Tournament Filtering

**Problem:** The tournament list includes administrative entries that aren't real tournaments.

**Solution:** Filter out entries with these names:
- "בעדכון הבא" (next update)
- "עדכון " (update, with trailing space)
- "התחרות לא תחושב" (tournament won't be calculated)

---

### Date Parsing

**Problem:** Dates come in DD/MM/YYYY format (Israeli/European), not the ISO YYYY-MM-DD that JavaScript expects.

**Solution:** Always parse Israeli dates explicitly — split on `/`, rearrange to YYYY-MM-DD, then create Date object. Never rely on `new Date(string)` which assumes MM/DD/YYYY in some locales.

---

### Rate Limiting Detection

**Problem:** The site doesn't return explicit rate limit headers, but starts responding slowly or timing out when overloaded.

**Solution:** Implement adaptive delay detection:
1. Start with a candidate delay (e.g., 1000ms)
2. Make a few test requests, measure response times
3. If average response time > (delay × 0.9), increase the delay
4. Conservative fallback: 2000ms between requests

---

## 3. Database & Prisma

### JSON Field Handling

**Problem:** When storing JavaScript objects in Prisma JSON fields (type `Json` / PostgreSQL `JSONB`), TypeScript sometimes rejects the value because Prisma's `InputJsonValue` type doesn't match plain objects.

**Solution:** Wrap the value in `JSON.parse(JSON.stringify(value))` before passing to Prisma. This creates a clean JSON-compatible value that satisfies the type checker. Apply this to all JSON field writes.

---

### Prisma 7 Setup

If using Prisma 7+:
- A `prisma.config.ts` file is required (replaces some default configurations)
- Must install and use `@prisma/adapter-pg` for PostgreSQL connections
- Client instantiation requires passing the adapter explicitly
- Use a global singleton pattern to prevent multiple Prisma clients during development hot reloads

---

### Player Deduplication Strategy

**Problem:** The same player can appear from multiple data sources (chess-results.com, chess.org.il) with slightly different names or missing FIDE IDs.

**Solution:** Three-tier matching:
1. **FIDE ID exact match** — highest confidence, always use when available
2. **Normalized name + country + rating within 50 points** — fuzzy match for players without FIDE ID
3. **Create new player** — when no match is found

Important: Never generate synthetic FIDE IDs (e.g., "nofide-john-smith"). Keep FIDE ID null when unknown.

When updating existing players, always prefer newer data but preserve existing non-null values: `field: newValue ?? existingValue`

---

### Index Strategy

Create indexes on:
- Frequently filtered columns: `status`, `lastScrapedAt`, `sourceType`, `rating`, `country`
- Foreign key columns: `tournamentId`, `playerId`
- Compound indexes for common query patterns: `[tournamentId, round]`, `[playerId, ratingType]`
- Unique constraints on natural keys: `[tournamentId, playerId]`, `[tournamentId, round, board]`

---

### Cascade Deletes

Use `onDelete: Cascade` on relationships where child records have no meaning without the parent. For example, if a tournament is deleted, all its pairings, standings entries, and round snapshots should be deleted too.

---

## 4. Next.js & Routing

### Async Parameters (Next.js 15+)

**Problem:** In Next.js 15+, `params`, `cookies()`, and `headers()` in route handlers are now async. Code that accesses them synchronously will break.

**Solution:** Always `await` these values:
```
const { id } = await params;
const cookieStore = await cookies();
```

This applies to all route handlers in `app/api/` and all page components that access params.

---

### Route Handler Pattern

API routes live in `app/api/[path]/route.ts` and export named functions for HTTP methods (GET, POST, PUT, DELETE). Each function receives a `Request` object and returns a `Response`.

For route parameters, use the second argument: `(req: Request, { params }: { params: Promise<{ id: string }> })`

---

### Middleware Considerations

- Middleware runs on every request before route handlers
- Keep middleware lightweight — it affects response time for all routes
- Use matcher config to limit which routes middleware applies to

---

## 5. Testing

### Timeout Configuration

**Problem:** Default timeouts are too short. Database queries, scraping, and dev server startup all take longer than typical web app operations, causing flaky tests.

**Solution:** Set generous timeouts:
- **Test timeout**: 90 seconds (for E2E tests involving data loading)
- **Navigation timeout**: 60 seconds (pages that fetch from database)
- **Action timeout**: 30 seconds (click, fill, hover)
- **Dev server startup**: 120 seconds (cold start with compilation)

---

### Selector Stability

**Problem:** Dynamic UUIDs in URLs and element IDs change between test runs, making selectors fragile.

**Solution:**
- Use fixture files with known, stable IDs (e.g., a pre-imported tournament ID)
- Navigate directly to known URLs rather than clicking through the UI
- Use `:visible` filters to avoid matching hidden elements (especially with tabs)
- Prefer `getByRole`, `getByText`, and `data-testid` attributes over CSS selectors

---

### Tab/Panel Visibility

**Problem:** Playwright can match elements inside hidden tab panels. If you have 3 tabs and each has a table, a query for "table" might match one in a hidden panel.

**Solution:** Always add a visibility filter when selecting inside tabbed interfaces. Use `:visible` pseudo-selector or `{ hidden: false }` option on role-based queries.

---

### Avoiding Retry Cascades

**Problem:** Adding local retry logic inside tests (e.g., retry a click 3 times) causes cascading timeouts when the underlying issue is slow loading rather than missing elements.

**Solution:** Don't add retry logic in tests. Instead:
- Use proper `waitFor` conditions
- Increase global timeouts
- Use `reuseExistingServer: true` to avoid cold starts between test files
- Run tests sequentially (`fullyParallel: false, workers: 1`) in development

---

### Fixtures Strategy

Create a fixtures file with known database IDs that tests can rely on:
- A tournament ID known to exist in the test database
- A player starting rank known to exist in that tournament
- URLs constructed from these IDs

Pre-import test data as part of the test setup, or ensure the dev database always contains the fixture tournament.

---

## 6. Performance & Caching

### Two-Tier Cache

**Architecture:**
- **L1 (In-memory)**: Fast, limited capacity (e.g., 1000 keys), short TTL (30 seconds). Used for hot data like active tournament standings.
- **L2 (Redis)**: Larger capacity, longer TTL (5 minutes). Used for scraped data, computed analytics.

Check L1 first, then L2, then compute/fetch.

---

### Redis Graceful Degradation

**Problem:** If Redis is unavailable (not configured, connection lost), the application shouldn't crash.

**Solution:** Make all Redis operations no-ops when `REDIS_URL` is not set. Wrap Redis calls in try/catch — on failure, fall back to computing the value fresh. Log the cache miss but don't throw.

---

### Cache Invalidation

**Problem:** When tournament data is refreshed, stale cache entries must be cleared.

**Solution:** Use key prefixes like `tournament:{id}:*` and SCAN + DEL to clear all related keys. Avoid using `KEYS` command in production (blocks Redis).

---

### Player Matching Performance

**Problem:** Searching the full player database for fuzzy name matches is slow with thousands of players.

**Solution:** First filter candidates by country (exact match), which dramatically reduces the search space. Then do in-memory name normalization and distance calculation on the reduced set. Cap the candidate query at 500 rows.

---

### Crosstable Caching

**Problem:** The crosstable is expensive to scrape and parse, but needed for multiple features (tiebreaks, analytics, what-if).

**Solution:** Cache the parsed crosstable in the tournament's metadata JSON field in the database. This survives application restarts (unlike in-memory cache) and avoids re-scraping.

---

## 7. Analytics & Math

### Elo Rating Calculations

**Expected Score:**
```
E = 1 / (1 + 10^((opponentRating - playerRating) / 400))
```

**K-Factor (tiered):**
- K = 40 for ratings below 2300
- K = 20 for ratings 2300–2399
- K = 10 for ratings 2400+

**Rating Change:**
```
ΔR = K × (actualScore - expectedScore)
```

**Performance Rating (TPR):**
```
TPR = averageOpponentRating + 400 × (wins - losses) / totalGames
```

**Win/Draw/Loss Probability:**
- Include ~50 Elo points white advantage in the model
- Draw probability modeled separately (not just "1 - Pwin - Ploss")

---

### Monte Carlo Simulation

- **Default iterations**: 50,000 (configurable)
- For each iteration: simulate all remaining games using Elo probabilities, calculate final standings
- **Output per player**: P(1st), P(top 3), expected points, std deviation, full position distribution
- Only meaningful for ongoing tournaments — completed tournaments show deterministic results
- Consider parallelizing simulation across web workers for responsiveness

---

### Tiebreak Calculations

**Buchholz**: Sum of all opponents' final points. For BYEs, use the player's own final points as the virtual opponent's score.

**Sonneborn-Berger**: For each opponent, multiply (opponent's final points) × (your score against them). Sum these products. Exclude BYEs.

**Implementation note**: Both tiebreaks require the full crosstable to compute correctly. Make sure the crosstable is loaded before attempting tiebreak calculations.

---

### Rating Prediction (Israeli Federation Analytics)

- **Method**: Weighted linear regression on rating history data points
- **Weighting**: Exponential decay — recent data weighted more heavily (decay constant λ = 0.1)
- **Minimum data**: Need at least 3 data points to run regression
- **Velocity**: Slope of the regression line (points per month)
- **Momentum**: Classified as Rising (slope > +3), Declining (slope < -3), or Stable
- **Milestone estimation**: If slope is positive, estimate months to reach next round number (e.g., 1800, 1900, 2000)

---

### Magic Numbers

**Clinch calculation**: A player has clinched position X if their current points + points from remaining games (assuming all losses for them and all wins for competitors) still keeps them in position X.

**Elimination calculation**: A player is eliminated from position X if their maximum possible points (current + all remaining games won) is still less than what the current Xth-place player already has.

**"Alive" calculation**: Points needed = (current leader's points) - (player's current points), adjusted for remaining games.
