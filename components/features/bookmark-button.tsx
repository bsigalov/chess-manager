"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BookmarkButtonProps {
  tournamentId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({
  tournamentId,
  initialBookmarked = false,
}: BookmarkButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    startTransition(async () => {
      try {
        if (bookmarked) {
          const res = await fetch("/api/users/me/following/tournaments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournamentId }),
          });

          if (!res.ok) {
            throw new Error("Failed to remove bookmark");
          }

          setBookmarked(false);
          toast.success("Bookmark removed");
        } else {
          const res = await fetch("/api/users/me/following/tournaments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournamentId }),
          });

          if (!res.ok) {
            throw new Error("Failed to bookmark");
          }

          setBookmarked(true);
          toast.success("Tournament bookmarked");
        }
      } catch {
        toast.error(
          bookmarked
            ? "Failed to remove bookmark"
            : "Failed to bookmark tournament"
        );
      }
    });
  }

  return (
    <Button
      variant={bookmarked ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark tournament"}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
      ) : (
        <Star
          className={`h-4 w-4 mr-1 ${bookmarked ? "fill-current" : ""}`}
        />
      )}
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}
