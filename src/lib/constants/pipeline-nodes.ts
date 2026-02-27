import type { PipelineNodeConfig } from "@/types/pipeline-ui";

// -- 5-Node Pipeline Configuration --
// Maps server PipelinePhase values to visualization nodes

export const PIPELINE_NODES: PipelineNodeConfig[] = [
  {
    phase: "spec",
    label: "Spec",
    icon: "FileText",
    serverPhases: ["planning"],
  },
  {
    phase: "plan",
    label: "Plan",
    icon: "ListChecks",
    serverPhases: [],
  },
  {
    phase: "code",
    label: "Code",
    icon: "Code2",
    serverPhases: ["coding", "fixing"],
  },
  {
    phase: "review",
    label: "Review",
    icon: "Search",
    serverPhases: ["reviewing"],
  },
  {
    phase: "done",
    label: "Done",
    icon: "CheckCircle2",
    serverPhases: ["completed"],
  },
];

// -- Panel Dimension Constants --

export const LOG_PANEL_COLLAPSED_HEIGHT = 36;
export const LOG_PANEL_DEFAULT_HEIGHT = 300;
export const LOG_PANEL_MAX_HEIGHT_VH = 50;

// -- Animation Durations (ms) --

export const CONNECTOR_FILL_DURATION = 0.8;
export const NODE_PULSE_DURATION = 2;
export const NODE_ICON_SWAP_DURATION = 0.2;
export const PANEL_SPRING_STIFFNESS = 300;
export const PANEL_SPRING_DAMPING = 30;

// -- Typing Effect Defaults --

export const TYPING_CHARS_PER_FRAME = 30;
export const TYPING_FRAME_INTERVAL_MS = 50;

// -- Auto-Scroll Threshold --

export const AUTO_SCROLL_THRESHOLD_PX = 50;

// -- Log Entry Grouping Threshold --

export const LOG_ENTRY_GROUP_THRESHOLD_MS = 500;
