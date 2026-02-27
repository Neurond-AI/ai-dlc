"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { AgentLogPanel } from "@/components/logs/agent-log-panel";
import {
  LOG_PANEL_COLLAPSED_HEIGHT,
  LOG_PANEL_MAX_HEIGHT_VH,
  PANEL_SPRING_STIFFNESS,
  PANEL_SPRING_DAMPING,
} from "@/lib/constants/pipeline-nodes";
import { AGENT_TAB_COLORS } from "@/types/agent-log-ui";
import type { AgentType } from "@/types/agent";

export function BottomDock() {
  const isExpanded = useUIStore((s) => s.isLogPanelExpanded);
  const panelHeight = useUIStore((s) => s.logPanelHeight);
  const togglePanel = useUIStore((s) => s.toggleLogPanel);
  const setPanelHeight = useUIStore((s) => s.setLogPanelHeight);
  const activeLogTab = useUIStore((s) => s.activeLogTab);

  const hasRunningPipeline = usePipelineStore((s) =>
    Array.from(s.pipelineRuns.values()).some((run) => run.status === "running")
  );

  const activeAgentColor = AGENT_TAB_COLORS[activeLogTab as AgentType] ?? "#6B7280";

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = panelHeight;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY;
        const maxHeight = window.innerHeight * (LOG_PANEL_MAX_HEIGHT_VH / 100);
        const newHeight = Math.max(
          LOG_PANEL_COLLAPSED_HEIGHT,
          Math.min(maxHeight, startHeight + delta)
        );
        setPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelHeight, setPanelHeight]
  );

  return (
    <motion.div
      className="flex-shrink-0 border-t bg-card flex flex-col"
      animate={{ height: isExpanded ? panelHeight : LOG_PANEL_COLLAPSED_HEIGHT }}
      transition={{ type: "spring", stiffness: PANEL_SPRING_STIFFNESS, damping: PANEL_SPRING_DAMPING }}
      data-testid="bottom-dock"
    >
      {/* Resize handle (only when expanded) */}
      {isExpanded && (
        <div
          className="flex h-2 shrink-0 cursor-row-resize items-center justify-center hover:bg-muted/50"
          onMouseDown={handleResizeStart}
          onDoubleClick={togglePanel}
          data-testid="bottom-dock-resize-handle"
          aria-label="Resize agent log panel"
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      {/* Toggle bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Agent Logs
          </span>
          {hasRunningPipeline && !isExpanded && (
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: activeAgentColor }}
              data-testid="bottom-dock-activity-dot"
              aria-label="Pipeline running"
            />
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={togglePanel}
          aria-label={isExpanded ? "Collapse agent logs" : "Expand agent logs"}
          aria-expanded={isExpanded}
          data-testid="bottom-dock-toggle"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Panel content (only when expanded) */}
      {isExpanded && (
        <div
          className="flex-1 overflow-hidden"
          data-testid="bottom-dock-content"
        >
          <AgentLogPanel />
        </div>
      )}
    </motion.div>
  );
}
