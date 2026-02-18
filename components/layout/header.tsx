"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Trophy, Sun, Moon, Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { NotificationBell } from "@/components/features/notification-bell";
import { FavoritesDropdown } from "@/components/features/favorites-dropdown";
import { useState } from "react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Trophy className="h-5 w-5" />
          ChessManager
        </Link>

        {/* Desktop nav */}
        <nav className="ml-8 hidden md:flex items-center gap-6">
          <Link
            href="/tournaments"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Tournaments
          </Link>
          <Link
            href="/players"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Players
          </Link>
          {session?.user && (
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Auth: notifications + user menu or sign-in button */}
          {status !== "loading" && (
            <>
              {session?.user ? (
                <>
                  <FavoritesDropdown />
                  <NotificationBell />
                  <UserMenu />
                </>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/signin">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in
                  </Link>
                </Button>
              )}
            </>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t p-4 space-y-1">
          <Link
            href="/tournaments"
            className="block py-2 text-sm hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Tournaments
          </Link>
          <Link
            href="/players"
            className="block py-2 text-sm hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Players
          </Link>
          {session?.user && (
            <>
              <Link
                href="/dashboard"
                className="block py-2 text-sm hover:text-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="block py-2 text-sm hover:text-foreground transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Settings
              </Link>
            </>
          )}
          {!session?.user && (
            <Link
              href="/auth/signin"
              className="block py-2 text-sm hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
