import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/layout/header";
import { FollowedPlayersProvider } from "@/components/providers/followed-players-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chess Tournament Manager",
  description: "Track chess tournaments from chess-results.com",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthSessionProvider>
          <FollowedPlayersProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <Header />
              <main>{children}</main>
              <Toaster />
            </ThemeProvider>
          </FollowedPlayersProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
