"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react";
import type { PlayerAnalytics } from "@/lib/analytics/player-analytics";
import type { PlayerProfile, RatingEntry } from "@/lib/scrapers/chess-org-il";

interface PlayerSummaryCardProps {
  profile: PlayerProfile;
  analytics: PlayerAnalytics;
  ratingHistory: RatingEntry[];
}

function MomentumBadge({ momentum }: { momentum: "rising" | "declining" | "plateau" }) {
  const config = {
    rising: { label: "Rising", className: "bg-green-500/15 text-green-600 border-green-500/30" },
    declining: { label: "Declining", className: "bg-red-500/15 text-red-600 border-red-500/30" },
    plateau: { label: "Plateau", className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  };
  const { label, className } = config[momentum];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function VelocityIndicator({ velocity }: { velocity: number }) {
  const absVelocity = Math.abs(velocity);
  const formatted = velocity >= 0 ? `+${absVelocity.toFixed(1)}` : `-${absVelocity.toFixed(1)}`;

  if (velocity > 3) {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <ArrowUpIcon className="h-4 w-4" />
        {formatted} pts/mo
      </span>
    );
  }
  if (velocity < -3) {
    return (
      <span className="flex items-center gap-1 text-red-600">
        <ArrowDownIcon className="h-4 w-4" />
        {formatted} pts/mo
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <MinusIcon className="h-4 w-4" />
      {formatted} pts/mo
    </span>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  // Normalize values to 0-100 range for SVG viewBox
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const height = 24;
  const width = 60;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  // Color based on trend (last value vs first value)
  const trend = values[values.length - 1] - values[0];
  const strokeColor = trend > 0 ? "#16a34a" : trend < 0 ? "#dc2626" : "#6b7280";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-6 w-15"
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayerSummaryCard({ profile, analytics, ratingHistory }: PlayerSummaryCardProps) {
  const currentAge = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Player info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums">{profile.israeliRating}</span>
              <span className="text-sm text-muted-foreground">Israeli Rating</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {profile.fideRatingStandard && (
                <span>FIDE: {profile.fideRatingStandard}</span>
              )}
              {currentAge && <span>Age: {currentAge}</span>}
              {profile.club && <span>Club: {profile.club}</span>}
            </div>
            <div className="flex items-center gap-3">
              <VelocityIndicator velocity={analytics.velocity} />
              <MiniSparkline values={analytics.velocitySeries.slice(-12)} />
              <MomentumBadge momentum={analytics.momentum} />
            </div>
          </div>

          {/* Right: Key metrics */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold tabular-nums">{analytics.peakRating}</div>
              <div className="text-xs text-muted-foreground">Peak Rating</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{analytics.monthsSincePeak}</div>
              <div className="text-xs text-muted-foreground">Mo Since Peak</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {ratingHistory.length}
              </div>
              <div className="text-xs text-muted-foreground">Data Points</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { MomentumBadge, VelocityIndicator, MiniSparkline };
