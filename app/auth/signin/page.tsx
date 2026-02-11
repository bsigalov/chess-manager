import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";

function getAvailableProviders() {
  const providers: string[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push("github");
  }

  return providers;
}

export default function SignInPage() {
  const providers = getAvailableProviders();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <SignInForm providers={providers} />
        </Suspense>
      </div>
    </div>
  );
}
