"use client";

import React from "react";
import { useTypingEffect } from "@/hooks/use-typing-effect";
import type { LogEntry as LogEntryType } from "@/types/agent-log-ui";

interface LogEntryProps {
  entry: LogEntryType;
  color: string;
}

export function LogEntry({ entry, color }: LogEntryProps) {
  const { displayedText, isTyping } = useTypingEffect({
    text: entry.content,
    enabled: entry.isStreaming,
  });

  const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const displayContent = entry.isStreaming ? displayedText : entry.content;

  return (
    <div
      className="flex gap-2 py-0.5"
      data-testid={`log-entry-${entry.id}`}
    >
      <span className="shrink-0 select-none text-muted-foreground">
        [{timestamp}]
      </span>
      <span style={{ color }}>
        {displayContent}
        {isTyping && (
          <span
            className="ml-px animate-blink"
            style={{ color }}
            aria-hidden="true"
          >
            |
          </span>
        )}
      </span>
    </div>
  );
}
