"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FollowButtonProps {
  playerId: string;
  initialFollowed?: boolean;
}

export function FollowButton({
  playerId,
  initialFollowed = false,
}: FollowButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [followed, setFollowed] = useState(initialFollowed);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    startTransition(async () => {
      try {
        if (followed) {
          const res = await fetch("/api/users/me/following/players", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId }),
          });

          if (!res.ok) {
            throw new Error("Failed to unfollow");
          }

          setFollowed(false);
          toast.success("Player unfollowed");
        } else {
          const res = await fetch("/api/users/me/following/players", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId }),
          });

          if (!res.ok) {
            throw new Error("Failed to follow");
          }

          setFollowed(true);
          toast.success("Player followed");
        }
      } catch {
        toast.error(followed ? "Failed to unfollow player" : "Failed to follow player");
      }
    });
  }

  return (
    <Button
      variant={followed ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label={followed ? "Unfollow player" : "Follow player"}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1" />
      ) : (
        <Heart
          className={`h-4 w-4 mr-1 ${followed ? "fill-current" : ""}`}
        />
      )}
      {followed ? "Following" : "Follow"}
    </Button>
  );
}
