import * as dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import { CookieSession, extractViewState } from '../lib/scrapers/chess-org-il';

async function main() {
  const session = new CookieSession();
  const path = '/Players/Player.aspx?Id=205758';

  // GET the player page
  let { html, viewState: vs } = await session.get(path);

  // Check what buttons/tabs exist
  const lines = html.split('\n');
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t && (t.includes('ShowGame') || t.includes('GamesButton') || t.includes('Games') || t.includes('משחק'))) {
      console.log(`Profile L${i}: ${t.slice(0, 160)}`);
    }
  });

  // Click games tab
  console.log('\nClicking games tab...');
  ({ html, viewState: vs } = await session.doPostBack(
    path,
    'ctl00$ContentPlaceHolder1$PlayerFormView$ShowGamesButton',
    '',
    vs
  ));

  fs.writeFileSync('/tmp/games-tab.html', html);
  console.log('Games tab HTML saved, length:', html.length);

  // Look for table rows
  const gLines = html.split('\n');
  let inGamesSection = false;
  gLines.forEach((line, i) => {
    const t = line.trim();
    if (t.includes('GamesGrid') || t.includes('משחק') || t.includes('ShowGames')) inGamesSection = true;
    if (inGamesSection && i > 380 && i < 500 && t) {
      console.log(`L${i}: ${t.slice(0, 160)}`);
    }
  });
}
main().catch(console.error);
