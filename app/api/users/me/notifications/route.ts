import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
    );

    const where = {
      userId: user.id,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { sentAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        read: n.read,
        readAt: n.readAt,
        sentAt: n.sentAt,
      })),
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth();

    await prisma.notification.deleteMany({
      where: {
        userId: user.id,
        read: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Clear notifications error:", error);
    return NextResponse.json(
      { error: "Failed to clear notifications" },
      { status: 500 }
    );
  }
}
