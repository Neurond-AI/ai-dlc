"use client";

import React from "react";
import { ArrowDown } from "lucide-react";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { LogEntry } from "./log-entry";
import type { LogEntry as LogEntryType } from "@/types/agent-log-ui";
import type { AgentType } from "@/types/agent";

interface AgentLogTabProps {
  agentType: AgentType;
  logs: LogEntryType[];
  color: string;
  isActive: boolean;
  emptyMessage: string;
}

export function AgentLogTab({
  agentType,
  logs,
  color,
  isActive: _isActive,
  emptyMessage,
}: AgentLogTabProps) {
  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll();

  if (logs.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
        data-testid={`agent-log-tab-empty-${agentType}`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="h-full overflow-y-auto scroll-smooth px-3 py-2 font-mono text-sm leading-relaxed"
        data-testid={`agent-log-tab-scroll-${agentType}`}
      >
        {logs.map((entry) => (
          <LogEntry key={entry.id} entry={entry} color={color} />
        ))}
      </div>

      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 right-3 flex items-center gap-1 rounded-full border bg-background/80 px-3 py-1 text-xs shadow-md backdrop-blur-sm"
          data-testid={`agent-log-jump-to-latest-${agentType}`}
          aria-label="Jump to latest log entry"
        >
          Jump to latest
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
