"use client";

import { cn } from "@/lib/utils";
import type { DiffHunk, DiffLine } from "@/types/diff";
import { CodeBlock } from "./code-block";

interface DiffHunkViewProps {
  hunk: DiffHunk;
  language: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlighter: any | null;
}

interface DiffLineRowProps {
  line: DiffLine;
  oldLineNum: number | null;
  newLineNum: number | null;
  language: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlighter: any | null;
}

function DiffLineRow({ line, oldLineNum, newLineNum, language, highlighter }: DiffLineRowProps) {
  if (line.lineNumber === -1) {
    return (
      <div
        className="col-span-full bg-muted py-2 text-center font-mono text-sm text-muted-foreground"
        data-testid="diff-truncation-marker"
      >
        {line.content}
      </div>
    );
  }

  const bgClass = {
    added: "bg-emerald-50 dark:bg-emerald-950/20",
    removed: "bg-red-50 dark:bg-red-950/20",
    unchanged: "",
  }[line.type];

  const gutterBgClass = {
    added: "bg-emerald-100 dark:bg-emerald-900/30",
    removed: "bg-red-100 dark:bg-red-900/30",
    unchanged: "bg-muted/30",
  }[line.type];

  const gutterTextClass = {
    added: "text-emerald-600 dark:text-emerald-400",
    removed: "text-red-600 dark:text-red-400",
    unchanged: "text-muted-foreground",
  }[line.type];

  const prefix = { added: "+", removed: "-", unchanged: " " }[line.type];

  const ariaLabel =
    line.type === "added"
      ? `Added line ${newLineNum}: ${line.content}`
      : line.type === "removed"
      ? `Removed line ${oldLineNum}: ${line.content}`
      : undefined;

  return (
    <div
      className={cn("flex min-h-[20px] w-full", bgClass)}
      aria-label={ariaLabel}
      data-testid={`diff-line-${line.type}`}
    >
      {/* Old line number */}
      <span
        className={cn(
          "w-10 flex-shrink-0 select-none pr-2 text-right text-xs leading-5",
          gutterBgClass,
          gutterTextClass
        )}
        aria-hidden="true"
      >
        {oldLineNum ?? ""}
      </span>
      {/* New line number */}
      <span
        className={cn(
          "w-10 flex-shrink-0 select-none pr-2 text-right text-xs leading-5",
          gutterBgClass,
          gutterTextClass
        )}
        aria-hidden="true"
      >
        {newLineNum ?? ""}
      </span>
      {/* Prefix indicator */}
      <span
        className={cn(
          "w-4 flex-shrink-0 select-none text-center text-xs leading-5",
          gutterTextClass
        )}
        aria-hidden="true"
      >
        {prefix}
      </span>
      {/* Content */}
      <div className="flex-1 overflow-x-auto pl-1">
        <CodeBlock
          content={line.content}
          language={language}
          lineType={line.type}
          highlighter={highlighter}
        />
      </div>
    </div>
  );
}

export function DiffHunkView({ hunk, language, highlighter }: DiffHunkViewProps) {
  // Track line number counters
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;

  return (
    <div data-testid="diff-hunk">
      {/* Hunk header */}
      <div
        className="border-y bg-muted/30 px-4 py-1 font-mono text-xs text-muted-foreground"
        data-testid="diff-hunk-header"
      >
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </div>

      {/* Lines */}
      {hunk.lines.map((line, i) => {
        const oldLineNum = line.type !== "added" && line.lineNumber !== -1 ? oldLine : null;
        const newLineNum = line.type !== "removed" && line.lineNumber !== -1 ? newLine : null;

        if (line.type !== "added" && line.lineNumber !== -1) oldLine++;
        if (line.type !== "removed" && line.lineNumber !== -1) newLine++;

        return (
          <DiffLineRow
            key={i}
            line={line}
            oldLineNum={oldLineNum}
            newLineNum={newLineNum}
            language={language}
            highlighter={highlighter}
          />
        );
      })}
    </div>
  );
}
