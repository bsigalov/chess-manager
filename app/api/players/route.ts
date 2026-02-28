import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const followed = searchParams.get("followed") === "true";
    const skip = (page - 1) * limit;

    const isNumericQuery = /^\d+$/.test(query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: query, mode: "insensitive" } } } },
        ...(isNumericQuery ? [{ fideId: query }] : []),
      ];
    }

    if (followed) {
      const session = await auth();
      if (session?.user?.id) {
        where.followedPlayers = { some: { userId: session.user.id } };
      } else {
        // Not authenticated — return empty
        return NextResponse.json({
          players: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        });
      }
    }

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        select: {
          id: true,
          name: true,
          title: true,
          rating: true,
          country: true,
          fideId: true,
          aliases: { select: { alias: true } },
        },
        orderBy: [{ rating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.player.count({ where }),
    ]);

    return NextResponse.json({
      players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Player search error:", error);
    return NextResponse.json(
      { error: "Failed to search players" },
      { status: 500 }
    );
  }
}
