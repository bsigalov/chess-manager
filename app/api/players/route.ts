import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const isNumericQuery = /^\d+$/.test(query);

    const where = query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            ...(isNumericQuery ? [{ fideId: query }] : []),
          ],
        }
      : {};

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
