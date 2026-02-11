"use client";

import { useRef, useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, LayoutDashboard, User } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menu on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (!session?.user) {
    return null;
  }

  const user = session.user;
  const initials = getInitials(user.name);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 rounded-full"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={user.image}
            alt={user.name ?? "User avatar"}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initials}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="px-3 py-2 border-b mb-1">
            <p className="text-sm font-medium truncate">{user.name ?? "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>

          <div className="border-t mt-1 pt-1">
            <button
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}
