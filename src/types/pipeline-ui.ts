import type { PipelinePhase } from "./pipeline";

// -- Pipeline Visualization Node --

export type VisualizationNodePhase = "spec" | "plan" | "code" | "review" | "done";

export type NodeStatus = "pending" | "active" | "completed" | "failed";

export type ConnectorStatus = "empty" | "filling" | "filled";

export interface PipelineNodeState {
  /** Which visualization node */
  phase: VisualizationNodePhase;
  /** Current visual status */
  status: NodeStatus;
  /** When this phase started (Unix ms), undefined if not yet started */
  startedAt?: number;
  /** When this phase completed (Unix ms), undefined if still active or pending */
  completedAt?: number;
  /** Duration in ms (completedAt - startedAt), undefined if not completed */
  duration?: number;
}

// -- Pipeline Node Configuration --

export interface PipelineNodeConfig {
  /** Visualization phase identifier */
  phase: VisualizationNodePhase;
  /** Display label */
  label: string;
  /** Lucide icon name */
  icon: string;
  /** Maps to server PipelinePhase(s) that activate this node */
  serverPhases: PipelinePhase[];
}

// -- Phase Timing --

export interface PhaseTiming {
  startedAt: number;
  completedAt?: number;
  duration?: number;
}

/**
 * Maps visualization node phase to its timing data.
 * Stored in pipelineStore.phaseTimings per taskId.
 */
export type PhaseTimingsMap = Partial<Record<VisualizationNodePhase, PhaseTiming>>;

// -- Node Status Colors --

export interface NodeColorScheme {
  /** Border/icon color */
  border: string;
  /** Background with opacity */
  bg: string;
  /** Text color */
  text: string;
  /** Glow/shadow color for pulse animation */
  glow: string;
}

export const NODE_STATUS_COLORS: Record<NodeStatus, NodeColorScheme> = {
  pending: {
    border: "#6B7280",
    bg: "bg-gray-500/5",
    text: "text-gray-400",
    glow: "rgba(107, 114, 128, 0)",
  },
  active: {
    border: "",
    bg: "",
    text: "",
    glow: "",
  },
  completed: {
    border: "#22C55E",
    bg: "bg-green-500/10",
    text: "text-green-500",
    glow: "rgba(34, 197, 94, 0.15)",
  },
  failed: {
    border: "#EF4444",
    bg: "bg-red-500/10",
    text: "text-red-500",
    glow: "rgba(239, 68, 68, 0.15)",
  },
};

/**
 * Phase-specific colors used when node is "active".
 * Maps server PipelinePhase to color for the active node.
 */
export const ACTIVE_PHASE_COLORS: Record<string, NodeColorScheme> = {
  planning: {
    border: "#F59E0B",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    glow: "rgba(245, 158, 11, 0.15)",
  },
  coding: {
    border: "#3B82F6",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  fixing: {
    border: "#3B82F6",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  reviewing: {
    border: "#8B5CF6",
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    glow: "rgba(139, 92, 246, 0.15)",
  },
  completed: {
    border: "#22C55E",
    bg: "bg-green-500/10",
    text: "text-green-500",
    glow: "rgba(34, 197, 94, 0.15)",
  },
};

// -- Hook Return Types --

export interface UsePipelineVisualizationReturn {
  /** Status of all 5 pipeline nodes */
  nodes: PipelineNodeState[];
  /** Whether any node is currently active (pipeline running) */
  isActive: boolean;
  /** Current iteration number (0 if no iterations) */
  iteration: number;
}

// -- Panel Dimensions --

export const LOG_PANEL_COLLAPSED_HEIGHT = 36;
export const LOG_PANEL_DEFAULT_HEIGHT = 300;
export const LOG_PANEL_MAX_HEIGHT_VH = 50;

// -- Auto-scroll --

export const AUTO_SCROLL_THRESHOLD_PX = 50;

// -- Typing Effect --

export const TYPING_CHARS_PER_FRAME = 30;
export const TYPING_FRAME_INTERVAL_MS = 50;

// -- Hook Option Types --

export interface UseTypingEffectOptions {
  text: string;
  charsPerFrame?: number;
  frameInterval?: number;
  enabled?: boolean;
}

export interface UseTypingEffectReturn {
  displayedText: string;
  isTyping: boolean;
}

export interface UseAutoScrollReturn {
  scrollRef: import("react").RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
}
