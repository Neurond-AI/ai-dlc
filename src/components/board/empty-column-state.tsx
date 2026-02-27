"use client";

import React from "react";

interface EmptyColumnStateProps {
  text: string;
}

export function EmptyColumnState({ text }: EmptyColumnStateProps) {
  return (
    <div
      className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-muted-foreground/30 px-3 py-4"
      data-testid="empty-column-state"
    >
      <p className="text-center text-xs text-muted-foreground/60">{text}</p>
    </div>
  );
}
