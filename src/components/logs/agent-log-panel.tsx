"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, Code2, Search } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useUIStore } from "@/stores/ui-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { AgentLogTab } from "./agent-log-tab";
import { AGENT_TABS } from "@/types/agent-log-ui";
import type { AgentType } from "@/types/agent";

const TAB_ICONS: Record<string, React.ElementType> = {
  Brain,
  Code2,
  Search,
};

export function AgentLogPanel() {
  const [activeTab, setActiveTab] = useState<AgentType>("planner");
  const [unreadTabs, setUnreadTabs] = useState<Set<AgentType>>(new Set());
  const prevLengthRef = useRef<Record<AgentType, number>>({
    planner: 0,
    coder: 0,
    reviewer: 0,
  });

  const taskId = useUIStore((s) => s.activeLogTaskId);
  const agentLogs = usePipelineStore((s) =>
    taskId ? s.agentLogs.get(taskId) : null
  );
  const pipelineRun = usePipelineStore((s) =>
    taskId ? s.pipelineRuns.get(taskId) : null
  );

  // Track unread tabs when new logs arrive on inactive tabs
  useEffect(() => {
    if (!agentLogs || !taskId) return;

    AGENT_TABS.forEach((tab) => {
      const currentLength = agentLogs[tab.type]?.length ?? 0;
      if (tab.type !== activeTab && currentLength > prevLengthRef.current[tab.type]) {
        setUnreadTabs((prev) => new Set(prev).add(tab.type));
      }
      prevLengthRef.current[tab.type] = currentLength;
    });
  }, [agentLogs, activeTab, taskId]);

  const handleTabChange = (value: string) => {
    const tab = value as AgentType;
    setActiveTab(tab);
    setUnreadTabs((prev) => {
      const next = new Set(prev);
      next.delete(tab);
      return next;
    });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full flex-col"
      data-testid="agent-log-panel"
    >
      <TabsList className="h-9 shrink-0 gap-1 bg-transparent px-2">
        {AGENT_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.icon] ?? Brain;
          return (
            <TabsTrigger
              key={tab.type}
              value={tab.type}
              className="relative gap-1.5 text-xs"
              data-testid={`agent-log-tab-trigger-${tab.type}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              {unreadTabs.has(tab.type) && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tab.color }}
                  aria-label={`New ${tab.label} logs`}
                  data-testid={`agent-log-unread-${tab.type}`}
                />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {AGENT_TABS.map((tab) => (
        <TabsContent
          key={tab.type}
          value={tab.type}
          className="flex-1 overflow-hidden mt-0"
          data-testid={`agent-log-tab-content-${tab.type}`}
        >
          <AgentLogTab
            agentType={tab.type}
            logs={agentLogs?.[tab.type] ?? []}
            color={tab.color}
            isActive={pipelineRun?.status === "running"}
            emptyMessage={
              !taskId
                ? "No logs yet -- start a pipeline to see agent output."
                : `Waiting for ${tab.label} to start...`
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
