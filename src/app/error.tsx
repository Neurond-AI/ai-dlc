"use client";

import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ reset }: ErrorProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-4"
      data-testid="error-boundary"
    >
      <div className="text-center">
        <h2 className="text-xl font-semibold">Something went wrong.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
      </div>
      <Button onClick={reset} variant="outline" data-testid="error-reset-button">
        Try again
      </Button>
    </div>
  );
}
