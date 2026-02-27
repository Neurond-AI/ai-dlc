"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { UnifiedDiff } from "@/types/diff";
import {
  getShikiHighlighter,
  isLanguageSupported,
} from "@/lib/services/syntax-highlighter";
import { DiffHunkView } from "./diff-hunk-view";

interface DiffViewerProps {
  diff: UnifiedDiff | null;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [highlighter, setHighlighter] = useState<any | null>(null);

  useEffect(() => {
    getShikiHighlighter().then(setHighlighter).catch(() => setHighlighter(null));
  }, []);

  if (!diff) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
        data-testid="diff-viewer-empty"
      >
        Select a file from the tree to view changes
      </div>
    );
  }

  const languageSupported = isLanguageSupported(diff.language);

  return (
    <div
      role="region"
      aria-label={`Diff viewer for ${diff.filePath}`}
      className="h-full overflow-auto font-mono text-sm"
      data-testid="diff-viewer"
    >
      {/* File header */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between border-b bg-muted/40 px-4 py-2 backdrop-blur"
        )}
        data-testid="diff-viewer-header"
      >
        <span className="truncate text-xs font-medium text-muted-foreground">
          {diff.filePath}
        </span>
        {!languageSupported && (
          <span className="ml-2 flex-shrink-0 text-[10px] text-muted-foreground">
            plain text
          </span>
        )}
      </div>

      {diff.hunks.length === 0 ? (
        <div
          className="flex items-center justify-center p-8 text-sm text-muted-foreground"
          data-testid="diff-viewer-no-changes"
        >
          No changes to display
        </div>
      ) : (
        diff.hunks.map((hunk, i) => (
          <DiffHunkView
            key={i}
            hunk={hunk}
            language={diff.language}
            highlighter={highlighter}
          />
        ))
      )}
    </div>
  );
}
