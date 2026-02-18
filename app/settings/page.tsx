"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, User, Bell, Palette, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Preferences {
  theme: string;
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  gameResultAlerts: boolean;
  roundStartAlerts: boolean;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchPreferences();
    }
  }, [status, router]);

  async function fetchPreferences() {
    try {
      const res = await fetch("/api/users/me/preferences");
      if (!res.ok) throw new Error();

      const data = await res.json();
      setPreferences(data.preferences);
    } catch {
      toast.error("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!preferences) return;

    setSaving(true);
    try {
      const res = await fetch("/api/users/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) throw new Error();

      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updatePreference<K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) {
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));
  }

  if (status === "loading" || loading) {
    return (
      <div className="container px-4 py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!session?.user || !preferences) return null;

  return (
    <div className="container px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </CardTitle>
            <CardDescription>
              Your account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input value={session.user.name ?? ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Name is managed by your authentication provider.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input value={session.user.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Email is managed by your authentication provider.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Email Notifications"
              description="Receive notifications via email"
              checked={preferences.emailNotifications}
              onChange={(v) => updatePreference("emailNotifications", v)}
            />
            <ToggleRow
              label="Push Notifications"
              description="Receive push notifications in your browser"
              checked={preferences.pushNotifications}
              onChange={(v) => updatePreference("pushNotifications", v)}
            />
            <ToggleRow
              label="Game Result Alerts"
              description="Get notified when a followed player finishes a game"
              checked={preferences.gameResultAlerts}
              onChange={(v) => updatePreference("gameResultAlerts", v)}
            />
            <ToggleRow
              label="Round Start Alerts"
              description="Get notified when a new round starts in bookmarked tournaments"
              checked={preferences.roundStartAlerts}
              onChange={(v) => updatePreference("roundStartAlerts", v)}
            />
          </CardContent>
        </Card>

        {/* Display Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Display
            </CardTitle>
            <CardDescription>
              Customize the appearance of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Theme</label>
              <div className="flex gap-2">
                {(["system", "light", "dark"] as const).map((theme) => (
                  <Button
                    key={theme}
                    variant={
                      preferences.theme === theme ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => updatePreference("theme", theme)}
                    className="capitalize"
                  >
                    {theme}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Language
              </label>
              <div className="flex gap-2">
                {[
                  { value: "en", label: "English" },
                  { value: "he", label: "Hebrew" },
                  { value: "ru", label: "Russian" },
                ].map((lang) => (
                  <Button
                    key={lang.value}
                    variant={
                      preferences.language === lang.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => updatePreference("language", lang.value)}
                  >
                    {lang.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
