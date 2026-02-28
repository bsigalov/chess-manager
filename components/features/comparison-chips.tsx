"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Calendar, Award, Swords, Trophy } from "lucide-react";

export type FilterType = "club" | "age" | "experience" | "opponents" | "tournament";

interface ComparisonChipsProps {
  activeFilters: Set<FilterType>;
  onToggleFilter: (filter: FilterType, tournamentId?: string) => void;
  isLoading: boolean;
  loadingFilter?: FilterType;
  recentTournaments?: { id: string; name: string }[];
  selectedTournamentId?: string;
  comparisonCount?: number;
}

const FILTER_CONFIG: Record<FilterType, { label: string; icon: React.ReactNode; description: string }> = {
  club: {
    label: "My Club",
    icon: <Users className="h-3.5 w-3.5" />,
    description: "Compare with club members",
  },
  age: {
    label: "Age ±2y",
    icon: <Calendar className="h-3.5 w-3.5" />,
    description: "Similar age players",
  },
  experience: {
    label: "Experience",
    icon: <Award className="h-3.5 w-3.5" />,
    description: "Similar rating history length",
  },
  opponents: {
    label: "Opponents",
    icon: <Swords className="h-3.5 w-3.5" />,
    description: "Players you've faced",
  },
  tournament: {
    label: "Tournament",
    icon: <Trophy className="h-3.5 w-3.5" />,
    description: "From a specific tournament",
  },
};

export function ComparisonChips({
  activeFilters,
  onToggleFilter,
  isLoading,
  loadingFilter,
  recentTournaments = [],
  selectedTournamentId,
  comparisonCount = 0,
}: ComparisonChipsProps) {

  const handleChipClick = (filter: FilterType) => {
    onToggleFilter(filter);
  };

  const handleTournamentSelect = (tournamentId: string) => {
    if (tournamentId === "none") {
      // Deselect tournament filter
      if (activeFilters.has("tournament")) {
        onToggleFilter("tournament");
      }
    } else {
      onToggleFilter("tournament", tournamentId);
    }
  };

  const renderChip = (filter: FilterType) => {
    const config = FILTER_CONFIG[filter];
    const isActive = activeFilters.has(filter);
    const isCurrentlyLoading = isLoading && loadingFilter === filter;

    if (filter === "tournament") {
      const tournamentIsActive = activeFilters.has("tournament");

      return (
        <div key={filter} className="flex items-center gap-1">
          <Select
            value={selectedTournamentId || "none"}
            onValueChange={handleTournamentSelect}
            disabled={isLoading}
          >
            <SelectTrigger
              className={`h-8 w-[140px] text-xs ${tournamentIsActive ? "bg-primary text-primary-foreground" : ""}`}
            >
              {isCurrentlyLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Trophy className="h-3.5 w-3.5 mr-1" />
              )}
              <SelectValue placeholder="Tournament" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No tournament</SelectItem>
              {recentTournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name.length > 20 ? t.name.substring(0, 20) + "..." : t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <Button
        key={filter}
        variant={isActive ? "default" : "outline"}
        size="sm"
        className="gap-1.5 h-8"
        onClick={() => handleChipClick(filter)}
        disabled={isLoading && loadingFilter !== filter}
      >
        {isCurrentlyLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          config.icon
        )}
        {config.label}
      </Button>
    );
  };

  const clearAllFilters = () => {
    activeFilters.forEach((f) => onToggleFilter(f));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground mr-1">Compare:</span>
        {(Object.keys(FILTER_CONFIG) as FilterType[]).map(renderChip)}
      </div>
      {activeFilters.size > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {comparisonCount} player{comparisonCount !== 1 ? "s" : ""} in comparison
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
