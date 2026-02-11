import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  anonymous: 0,
  viewer: 1,
  player: 2,
  organizer: 3,
  admin: 4,
};

/**
 * Get the current authenticated user or null.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}

/**
 * Require a minimum role level. Throws if the user does not meet the requirement.
 * Role hierarchy: admin > organizer > player > viewer > anonymous
 */
export async function requireRole(minimumRole: UserRole) {
  const user = await requireAuth();

  const userLevel = ROLE_HIERARCHY[user.role ?? "viewer"];
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (userLevel < requiredLevel) {
    throw new Error(
      `Insufficient permissions. Required: ${minimumRole}, current: ${user.role}`
    );
  }

  return user;
}
