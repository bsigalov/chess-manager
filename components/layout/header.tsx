"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Trophy, Sun, Moon, Menu, X, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { useState } from "react";

export function Header() {
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

          {/* Auth: User menu or sign-in button */}
          {status !== "loading" && (
            <>
              {session?.user ? (
                <UserMenu />
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
        <nav className="md:hidden border-t p-4">
          <Link
            href="/tournaments"
            className="block py-2 text-sm"
            onClick={() => setMobileOpen(false)}
          >
            Tournaments
          </Link>
          {!session?.user && (
            <Link
              href="/auth/signin"
              className="block py-2 text-sm"
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
