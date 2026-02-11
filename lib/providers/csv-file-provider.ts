import { parse } from 'csv-parse/sync';
import {
  DataProvider,
  ImportInput,
  NormalizedTournament,
  NormalizedPlayer,
} from './types';

/**
 * Canonical column names we look for (case-insensitive, partial match).
 */
const COLUMN_MATCHERS: Record<string, string[]> = {
  rank: ['rank', 'no', '#', 'pos', 'position', 'startingrank', 'starting rank', 'snr'],
  name: ['name', 'player', 'participant'],
  rating: ['rating', 'elo', 'rtg', 'fide rating', 'classical', 'standard'],
  fideId: ['fideid', 'fide id', 'fide_id', 'id', 'fide no'],
  federation: ['federation', 'fed', 'country', 'nat', 'nationality'],
  title: ['title', 'tit'],
  points: ['points', 'pts', 'score', 'total'],
  rapidRating: ['rapid', 'rapid rating', 'rapid elo'],
  blitzRating: ['blitz', 'blitz rating', 'blitz elo'],
};

interface ColumnMap {
  rank: number;
  name: number;
  rating: number;
  fideId: number;
  federation: number;
  title: number;
  points: number;
  rapidRating: number;
  blitzRating: number;
}

function matchColumn(header: string, patterns: string[]): boolean {
  const h = header.toLowerCase().trim();
  return patterns.some((p) => h === p || h.includes(p));
}

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    rank: -1,
    name: -1,
    rating: -1,
    fideId: -1,
    federation: -1,
    title: -1,
    points: -1,
    rapidRating: -1,
    blitzRating: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    for (const [key, patterns] of Object.entries(COLUMN_MATCHERS)) {
      if (map[key as keyof ColumnMap] === -1 && matchColumn(headers[i], patterns)) {
        map[key as keyof ColumnMap] = i;
      }
    }
  }

  return map;
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value.trim(), 10);
  if (isNaN(n) || n < 0 || n > 3500) return null;
  return n;
}

function generateExternalId(fileName: string | undefined): string {
  const base = fileName?.replace(/\.csv$/i, '') || 'csv-import';
  return `csv-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)}`;
}

export class CSVFileProvider implements DataProvider {
  readonly sourceType = 'csv-file' as const;

  canHandle(input: ImportInput): boolean {
    if (input.sourceType === 'csv-file') return true;
    if (input.fileName && input.fileName.toLowerCase().endsWith('.csv')) return true;
    return false;
  }

  async fetchTournament(input: ImportInput): Promise<NormalizedTournament> {
    const content = input.fileContent;
    if (!content || content.trim().length === 0) {
      throw new Error('CSVFileProvider requires non-empty fileContent');
    }

    // Detect delimiter: tab, semicolon, or comma
    const firstLine = content.split(/\r?\n/)[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';

    const records: string[][] = parse(content, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    if (records.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    const headers = records[0];
    const columnMap = detectColumns(headers);

    if (columnMap.name === -1) {
      throw new Error(
        'CSV file must contain a "Name" or "Player" column. ' +
          `Found columns: ${headers.join(', ')}`
      );
    }

    const players: NormalizedPlayer[] = [];
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const name = columnMap.name >= 0 ? row[columnMap.name]?.trim() : undefined;
      if (!name) continue;

      const rank =
        columnMap.rank >= 0 ? parseInt(row[columnMap.rank], 10) : i;
      const rating = columnMap.rating >= 0 ? parseRating(row[columnMap.rating]) : null;
      const fideId =
        columnMap.fideId >= 0 ? row[columnMap.fideId]?.trim() || null : null;
      const federation =
        columnMap.federation >= 0 ? row[columnMap.federation]?.trim() || null : null;
      const title =
        columnMap.title >= 0 ? row[columnMap.title]?.trim() || null : null;
      const rapidRating =
        columnMap.rapidRating >= 0 ? parseRating(row[columnMap.rapidRating]) : null;
      const blitzRating =
        columnMap.blitzRating >= 0 ? parseRating(row[columnMap.blitzRating]) : null;

      players.push({
        name,
        fideId: fideId && /^\d{3,}$/.test(fideId) ? fideId : null,
        title,
        rating,
        rapidRating,
        blitzRating,
        country: federation,
        startingRank: isNaN(rank) ? i : rank,
      });
    }

    if (players.length === 0) {
      throw new Error('No valid player rows found in CSV file');
    }

    const externalId = generateExternalId(input.fileName);
    const tournamentName = input.fileName?.replace(/\.csv$/i, '') || 'CSV Import';

    return {
      externalId,
      sourceType: 'csv-file',
      sourceUrl: input.fileName ? `file://${input.fileName}` : 'file://imported.csv',
      name: tournamentName,
      venue: null,
      city: null,
      country: null,
      startDate: new Date(),
      endDate: new Date(),
      rounds: 0,
      currentRound: 0,
      timeControl: null,
      tournamentType: null,
      status: 'imported',
      players,
      pairings: [], // CSV files don't contain pairing information
    };
  }
}
