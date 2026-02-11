import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Heart, Star, Bell, MapPin, Users, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard - Chess Tournament Manager",
};

async function getDashboardData(userId: string) {
  const [followedPlayers, bookmarkedTournaments, notifications] =
    await Promise.all([
      prisma.followedPlayer.findMany({
        where: { userId },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              title: true,
              rating: true,
              country: true,
              tournaments: {
                include: {
                  tournament: {
                    select: {
                      id: true,
                      name: true,
                      startDate: true,
                      status: true,
                    },
                  },
                },
                orderBy: { tournament: { startDate: "desc" } },
                take: 2,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userTournamentBookmark.findMany({
        where: { userId },
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              city: true,
              country: true,
              startDate: true,
              endDate: true,
              rounds: true,
              currentRound: true,
              status: true,
              _count: { select: { players: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { sentAt: "desc" },
        take: 10,
      }),
    ]);

  return { followedPlayers, bookmarkedTournaments, notifications };
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");

  const { followedPlayers, bookmarkedTournaments, notifications } =
    await getDashboardData(user.id);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user.name ?? "User"}
        </p>
      </div>

      <div className="grid gap-8">
        {/* Followed Players */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Followed Players
              <Badge variant="secondary">{followedPlayers.length}</Badge>
            </h2>
          </div>

          {followedPlayers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>You are not following any players yet.</p>
                <p className="text-sm mt-1">
                  Follow players from their profile pages to track their results
                  here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {followedPlayers.map((fp) => (
                <Link key={fp.id} href={`/players/${fp.player.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {fp.player.title && (
                          <span className="text-muted-foreground mr-1">
                            {fp.player.title}
                          </span>
                        )}
                        {fp.player.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {fp.player.country && (
                          <span>{fp.player.country}</span>
                        )}
                        {fp.player.rating && (
                          <span>Rating: {fp.player.rating}</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    {fp.player.tournaments.length > 0 && (
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-1">
                          Recent:
                        </p>
                        {fp.player.tournaments.map((tp) => (
                          <div
                            key={tp.tournament.id}
                            className="text-xs flex justify-between items-center"
                          >
                            <span className="truncate mr-2">
                              {tp.tournament.name}
                            </span>
                            <span className="text-muted-foreground flex-shrink-0">
                              {tp.points} pts
                              {tp.currentRank && ` (#${tp.currentRank})`}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Bookmarked Tournaments */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-5 w-5" />
              Bookmarked Tournaments
              <Badge variant="secondary">
                {bookmarkedTournaments.length}
              </Badge>
            </h2>
          </div>

          {bookmarkedTournaments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No bookmarked tournaments.</p>
                <p className="text-sm mt-1">
                  Bookmark tournaments to quickly access them from your
                  dashboard.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bookmarkedTournaments.map((b) => {
                const location = [b.tournament.city, b.tournament.country]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <Link
                    key={b.id}
                    href={`/tournaments/${b.tournament.id}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">
                            {b.tournament.name}
                          </CardTitle>
                          <Badge
                            variant={
                              b.tournament.status === "completed"
                                ? "secondary"
                                : "default"
                            }
                          >
                            {b.tournament.status === "completed"
                              ? "Completed"
                              : "Live"}
                          </Badge>
                        </div>
                        {location && (
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {location}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {b.tournament._count.players} players
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Round {b.tournament.currentRound}/
                            {b.tournament.rounds}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Notifications */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Activity
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} unread</Badge>
              )}
            </h2>
          </div>

          {notifications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No notifications yet.</p>
                <p className="text-sm mt-1">
                  Notifications about followed players and bookmarked
                  tournaments will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="divide-y">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 ${
                      !n.read ? "bg-accent/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.message}
                        </p>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
                        {formatTimeAgo(n.sentAt)}
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
