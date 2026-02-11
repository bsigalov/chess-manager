import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Target } from "lucide-react";

interface TournamentCardProps {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  rounds: number;
  currentRound: number;
  status: string;
  playerCount: number;
}

export function TournamentCard({
  id,
  name,
  city,
  country,
  startDate,
  endDate,
  rounds,
  currentRound,
  status,
  playerCount,
}: TournamentCardProps) {
  const location = [city, country].filter(Boolean).join(", ");
  const dates = `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`;

  return (
    <Link href={`/tournaments/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{name}</CardTitle>
            <Badge variant={status === "completed" ? "secondary" : "default"}>
              {status === "completed" ? "Completed" : "Live"}
            </Badge>
          </div>
          {location && (
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-xs text-muted-foreground">{dates}</p>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground gap-4">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {playerCount} players
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Round {currentRound}/{rounds}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
