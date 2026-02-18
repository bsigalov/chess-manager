import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import type { UserRole } from "@prisma/client";

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    );
  }

  // Credentials provider with a no-op authorize — the real authorize
  // logic lives in auth.ts (Node.js runtime) where Prisma is available.
  providers.push(
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: () => null,
    })
  );

  return providers;
}

/**
 * Edge-safe auth config — no Prisma, no pg, no Node.js crypto.
 * Used by middleware for JWT session verification only.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: getProviders(),
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role?: UserRole }).role ?? "viewer";
        token.claimedPlayerId =
          (user as { claimedPlayerId?: string | null }).claimedPlayerId ?? null;
      }

      if (trigger === "update" && session) {
        if (session.role) token.role = session.role;
        if (session.claimedPlayerId !== undefined) {
          token.claimedPlayerId = session.claimedPlayerId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = (token.role as UserRole) ?? "viewer";
        session.user.claimedPlayerId =
          (token.claimedPlayerId as string | null) ?? null;
      }
      return session;
    },
  },
};
