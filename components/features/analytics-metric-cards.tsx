"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PlayerAnalytics, WinRateBand } from "@/lib/analytics/player-analytics";

interface VelocityCardProps {
  velocity: number;
  velocitySeries: number[];
}

function MiniSparkline({ values, height = 32 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 80;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  // Color based on trend
  const trend = values[values.length - 1] - values[0];
  const strokeColor = trend > 0 ? "#16a34a" : trend < 0 ? "#dc2626" : "#6b7280";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-20"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VelocityCard({ velocity, velocitySeries }: VelocityCardProps) {
  const formatted = velocity >= 0 ? `+${velocity.toFixed(1)}` : velocity.toFixed(1);
  const color =
    velocity > 3 ? "text-green-600" : velocity < -3 ? "text-red-600" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Velocity Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{formatted}</span>
            <span className="ml-1 text-sm text-muted-foreground">pts/mo</span>
          </div>
          {velocitySeries.length >= 3 && (
            <MiniSparkline values={velocitySeries.slice(-12)} height={40} />
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {velocity > 3
            ? "Gaining rating at a healthy pace"
            : velocity < -3
              ? "Losing rating recently"
              : "Rating has been stable"}
        </p>
      </CardContent>
    </Card>
  );
}

interface MilestoneCardProps {
  milestones: { target: number; estimatedMonths: number | null }[];
  currentRating: number;
}

export function MilestoneCard({ milestones, currentRating }: MilestoneCardProps) {
  // Filter to show only reachable milestones (next 3 above current)
  const upcomingMilestones = milestones
    .filter((m) => m.target > currentRating)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Rating Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingMilestones.length > 0 ? (
          <div className="space-y-2">
            {upcomingMilestones.map((milestone) => {
              const gap = milestone.target - currentRating;
              return (
                <div key={milestone.target} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{milestone.target}</span>
                    <span className="text-xs text-muted-foreground">(+{gap})</span>
                  </div>
                  <span className="text-sm tabular-nums">
                    {milestone.estimatedMonths !== null ? (
                      <span className="text-green-600">~{milestone.estimatedMonths} mo</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            All major milestones achieved!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface WinRateCardProps {
  winRateByBand: WinRateBand[] | null;
  hasDeepData: boolean;
  onRequestScrape?: () => void;
  isScraping?: boolean;
}

function WinRateBar({ band, rate, games }: { band: string; rate: number; games: number }) {
  const percentage = rate * 100;
  // Color gradient from red (0%) through yellow (50%) to green (100%)
  const barColor =
    percentage >= 60 ? "#16a34a" : percentage >= 40 ? "#ca8a04" : "#dc2626";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate max-w-[140px]" title={band}>
          {band.replace(/\(.*\)/, "").trim()}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {percentage.toFixed(0)}% ({games})
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export function WinRateCard({
  winRateByBand,
  hasDeepData,
  onRequestScrape,
  isScraping = false,
}: WinRateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Win Rate by Opponent</CardTitle>
      </CardHeader>
      <CardContent>
        {winRateByBand && winRateByBand.length > 0 ? (
          <div className="space-y-3">
            {winRateByBand.map((band) => (
              <WinRateBar
                key={band.band}
                band={band.band}
                rate={band.rate}
                games={band.games}
              />
            ))}
          </div>
        ) : hasDeepData ? (
          <p className="text-sm text-muted-foreground">No game data available</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Requires game history data
            </p>
            {onRequestScrape && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={onRequestScrape}
                disabled={isScraping}
              >
                {isScraping ? "Scraping..." : "Scrape games for detailed stats"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricCardsGridProps {
  analytics: PlayerAnalytics;
  currentRating: number;
  hasDeepData: boolean;
  onRequestScrape?: () => void;
  isScraping?: boolean;
}

export function MetricCardsGrid({
  analytics,
  currentRating,
  hasDeepData,
  onRequestScrape,
  isScraping,
}: MetricCardsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <VelocityCard
        velocity={analytics.velocity}
        velocitySeries={analytics.velocitySeries}
      />
      <MilestoneCard
        milestones={analytics.milestones}
        currentRating={currentRating}
      />
      <WinRateCard
        winRateByBand={analytics.winRateByBand}
        hasDeepData={hasDeepData}
        onRequestScrape={onRequestScrape}
        isScraping={isScraping}
      />
    </div>
  );
}
