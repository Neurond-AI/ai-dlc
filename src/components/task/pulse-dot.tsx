"use client";

import React from "react";

interface PulseDotProps {
  isActive: boolean;
  color: string;
}

export function PulseDot({ isActive, color }: PulseDotProps) {
  if (!isActive) return null;

  return (
    <span
      className="relative flex h-2.5 w-2.5 flex-shrink-0"
      data-testid="pulse-dot"
      aria-label="Pipeline active"
    >
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
