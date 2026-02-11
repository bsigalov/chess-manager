import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await requireAuth();

    // Upsert: return existing or create default preferences
    const preferences = await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    });

    return NextResponse.json({
      preferences: {
        theme: preferences.theme,
        language: preferences.language,
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
        gameResultAlerts: preferences.gameResultAlerts,
        roundStartAlerts: preferences.roundStartAlerts,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Get preferences error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const {
      theme,
      language,
      emailNotifications,
      pushNotifications,
      gameResultAlerts,
      roundStartAlerts,
    } = body;

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (theme !== undefined) updateData.theme = theme;
    if (language !== undefined) updateData.language = language;
    if (emailNotifications !== undefined)
      updateData.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined)
      updateData.pushNotifications = pushNotifications;
    if (gameResultAlerts !== undefined)
      updateData.gameResultAlerts = gameResultAlerts;
    if (roundStartAlerts !== undefined)
      updateData.roundStartAlerts = roundStartAlerts;

    const preferences = await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...updateData,
      },
    });

    return NextResponse.json({
      preferences: {
        theme: preferences.theme,
        language: preferences.language,
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
        gameResultAlerts: preferences.gameResultAlerts,
        roundStartAlerts: preferences.roundStartAlerts,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
