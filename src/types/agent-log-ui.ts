import type { AgentType } from "./agent";

// -- Log Entry (Extended for UI) --

export interface LogEntry {
  /** Unique entry ID (generated client-side) */
  id: string;
  /** Which agent produced this entry */
  agentType: AgentType;
  /** Full text content (may grow if chunks are grouped) */
  content: string;
  /** Entry timestamp (Unix ms) */
  timestamp: number;
  /** Whether this entry is still receiving streaming chunks */
  isStreaming: boolean;
}

// -- Agent Tab Configuration --

export interface AgentTab {
  /** Agent identifier */
  type: AgentType;
  /** Display label */
  label: string;
  /** Hex color for accent (tab underline, text, dot) */
  color: string;
  /** Lucide icon name */
  icon: string;
}

export const AGENT_TABS: AgentTab[] = [
  { type: "planner", label: "Planner", color: "#F59E0B", icon: "Brain" },
  { type: "coder", label: "Coder", color: "#3B82F6", icon: "Code2" },
  { type: "reviewer", label: "Reviewer", color: "#8B5CF6", icon: "Search" },
];

/**
 * Lookup map for agent tab colors by agent type.
 */
export const AGENT_TAB_COLORS: Record<AgentType, string> = {
  planner: "#F59E0B",
  coder: "#3B82F6",
  reviewer: "#8B5CF6",
};

// -- Agent Logs State V2 (structured log entries per agent) --

export interface AgentLogsStateV2 {
  planner: LogEntry[];
  coder: LogEntry[];
  reviewer: LogEntry[];
}

// -- Log Entry Grouping --

export const LOG_ENTRY_GROUP_THRESHOLD_MS = 500;
