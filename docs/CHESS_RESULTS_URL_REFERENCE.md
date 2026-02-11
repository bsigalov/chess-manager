# Chess-Results.com URL Reference

## Base URL Pattern
```
https://s1.chess-results.com/tnr{TOURNAMENT_ID}.aspx?lan={LANGUAGE}&art={VIEW_TYPE}&rd={ROUND}
```

## URL Parameters

### Language (`lan`)
- `1` - English
- `2` - German
- `3` - Spanish
- `4` - French
- etc.

### View Type (`art`)
| Value | View Type | Description |
|-------|-----------|-------------|
| 0 | Starting Rank | Initial seeding list |
| 1 | Alphabetical | Players sorted by name |
| 2 | Pairings | Round pairings (requires `rd` parameter) |
| 3 | Results by Board | Game results for a round |
| 4 | Standings | Current standings after round X |
| 5 | Crosstable | Full tournament crosstable |
| 6 | Statistics | Federation statistics |
| 7 | Schedule | Tournament schedule |

### Round (`rd`)
- Integer value: 1, 2, 3, etc.
- Required for pairings and round-specific standings
- Special value `0` for "not paired"

## Example URLs

### Tournament Main Page
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1
```

### Starting Rank List
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1&art=0
```

### Round 5 Pairings
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1&art=2&rd=5
```

### Standings After Round 7
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1&art=4&rd=7
```

### Final Crosstable
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1&art=5
```

### Federation Filter
```
https://s1.chess-results.com/tnr1233866.aspx?lan=1&art=5&fed=ISR
```

## Additional Pages

### Tournament Details
```
https://chess-results.com/det{TOURNAMENT_ID}_{LANGUAGE}.aspx
```
Note: This redirects from s1 subdomain to main domain

### Player Details
- Linked directly from player names in tournament pages
- Format varies but typically includes player ID

## Data Available

### From Starting Rank (art=0)
- Player names
- Titles (GM, IM, FM, etc.)
- FIDE IDs
- Ratings
- Federations
- Clubs/Cities

### From Pairings (art=2)
- Board numbers
- White/Black assignments
- Player pairings
- Current points before round

### From Results (art=3)
- Game results (1-0, 0-1, ½-½)
- Updated after games finish

### From Standings (art=4)
- Current ranking
- Total points
- Tiebreak scores (TB1, TB2, TB3)
- Performance rating

### From Crosstable (art=5)
- Complete round-by-round results
- Head-to-head results
- Final standings

## Scraping Strategy

### Minimal URL Set for Complete Tournament Data

1. **Tournament Info**
   ```
   /tnr{id}.aspx?lan=1
   ```

2. **Player List**
   ```
   /tnr{id}.aspx?lan=1&art=0
   ```

3. **All Round Pairings**
   ```
   /tnr{id}.aspx?lan=1&art=2&rd={1...n}
   ```

4. **Current Standings**
   ```
   /tnr{id}.aspx?lan=1&art=4&rd={current_round}
   ```

5. **Final Crosstable** (for completed tournaments)
   ```
   /tnr{id}.aspx?lan=1&art=5
   ```

## Important Notes

1. **Server Load**: The site uses `s1`, `s2`, etc. subdomains for load balancing
2. **Encoding**: UTF-8 encoding for international names
3. **Updates**: Live tournaments update every few minutes
4. **Caching**: Implement aggressive caching to minimize requests
5. **User Agent**: Use a standard browser user agent
6. **Delays**: Add 2-5 second delays between requests

## Export Options

The site provides built-in export options:
- Excel (.xlsx) - Full tournament data
- PDF - Printable reports
- QR Codes - Mobile sharing

These can be found as links on various pages but should not be relied upon for scraping.