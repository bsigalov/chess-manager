import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
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

  providers.push(
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          claimedPlayerId: user.claimedPlayerId,
        };
      },
    })
  );

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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

      // Handle session updates (e.g., after role change)
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
});
