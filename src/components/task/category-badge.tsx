"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  type TaskCategory,
  CATEGORY_BADGE_COLORS,
  CATEGORY_LABELS,
} from "@/types/task";

interface CategoryBadgeProps {
  category: TaskCategory;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, size = "sm" }: CategoryBadgeProps) {
  const { bg, text } = CATEGORY_BADGE_COLORS[category];
  const label = CATEGORY_LABELS[category];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        bg,
        text,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      )}
      data-testid="category-badge"
    >
      {label}
    </span>
  );
}
