export type EventType =
  | 'game-result'
  | 'round-started'
  | 'standings-update'
  | 'import-complete'
  | 'tournament-update';

export interface TournamentEvent {
  type: EventType;
  tournamentId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface GameResultEvent extends TournamentEvent {
  type: 'game-result';
  data: {
    round: number;
    board: number;
    whiteName: string;
    blackName: string;
    result: string;
  };
}

export interface RoundStartedEvent extends TournamentEvent {
  type: 'round-started';
  data: {
    round: number;
    pairingsCount: number;
  };
}

export interface StandingsUpdateEvent extends TournamentEvent {
  type: 'standings-update';
  data: {
    round: number;
    leaderName: string;
    leaderPoints: number;
  };
}

export interface ImportCompleteEvent extends TournamentEvent {
  type: 'import-complete';
  data: {
    tournamentName: string;
    playerCount: number;
    roundCount: number;
  };
}
