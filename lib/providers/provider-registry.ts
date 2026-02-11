import { DataProvider, ImportInput } from './types';

class ProviderRegistry {
  private providers: DataProvider[] = [];

  register(provider: DataProvider): void {
    // Prevent duplicate registrations for the same source type
    const existing = this.providers.find(
      (p) => p.sourceType === provider.sourceType
    );
    if (existing) {
      throw new Error(
        `Provider for source type "${provider.sourceType}" is already registered`
      );
    }
    this.providers.push(provider);
  }

  resolve(input: ImportInput): DataProvider {
    const provider = this.providers.find((p) => p.canHandle(input));
    if (!provider) {
      throw new Error(
        `No provider found for input: ${JSON.stringify({
          sourceType: input.sourceType,
          url: input.url,
          fileName: input.fileName,
        })}`
      );
    }
    return provider;
  }

  getAll(): DataProvider[] {
    return [...this.providers];
  }
}

export const providerRegistry = new ProviderRegistry();

// --- Auto-register all providers ---
import { ChessResultsProvider } from './chess-results-provider';
import { LichessProvider } from './lichess-provider';
import { PGNFileProvider } from './pgn-file-provider';
import { CSVFileProvider } from './csv-file-provider';
import { FIDEProvider } from './fide-provider';

providerRegistry.register(new ChessResultsProvider());
providerRegistry.register(new LichessProvider());
providerRegistry.register(new PGNFileProvider());
providerRegistry.register(new CSVFileProvider());
providerRegistry.register(new FIDEProvider());
