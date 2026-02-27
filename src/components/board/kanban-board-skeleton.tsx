"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const COLUMN_CARD_COUNTS = [3, 1, 2, 0, 2];

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function KanbanBoardSkeleton() {
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      data-testid="kanban-board-skeleton"
    >
      {COLUMN_CARD_COUNTS.map((count, colIdx) => (
        <div
          key={colIdx}
          className="flex min-w-[240px] flex-1 flex-col rounded-lg border bg-muted/20"
          data-testid={`skeleton-column-${colIdx}`}
        >
          {/* Column header skeleton */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-7 rounded-full" />
          </div>

          {/* Card skeletons */}
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: count }).map((_, cardIdx) => (
              <SkeletonCard key={cardIdx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
