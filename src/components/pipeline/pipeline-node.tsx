"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ListChecks,
  Code2,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PipelineTimer } from "./pipeline-timer";
import type { PipelineNodeConfig, PipelineNodeState, NodeColorScheme } from "@/types/pipeline-ui";
import { NODE_STATUS_COLORS, ACTIVE_PHASE_COLORS } from "@/types/pipeline-ui";
import type { PipelinePhase } from "@/types/pipeline";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  ListChecks,
  Code2,
  Search,
  CheckCircle2,
  XCircle,
};

interface PipelineNodeProps {
  config: PipelineNodeConfig;
  state: PipelineNodeState;
  isActive: boolean;
  /** Current iteration number (for code node badge) */
  iteration?: number;
}

const DEFAULT_ACTIVE_COLORS: NodeColorScheme = {
  border: "#3B82F6",
  bg: "bg-blue-500/10",
  text: "text-blue-500",
  glow: "rgba(59, 130, 246, 0.15)",
};

function getNodeColors(
  state: PipelineNodeState,
  serverPhase: PipelinePhase | null
): NodeColorScheme {
  if (state.status === "active") {
    if (serverPhase && ACTIVE_PHASE_COLORS[serverPhase]) {
      return ACTIVE_PHASE_COLORS[serverPhase];
    }
    return DEFAULT_ACTIVE_COLORS;
  }
  return NODE_STATUS_COLORS[state.status] ?? NODE_STATUS_COLORS.pending;
}

function getNodeIcon(
  status: PipelineNodeState["status"],
  configIcon: string
): React.ElementType {
  if (status === "completed") return CheckCircle2;
  if (status === "failed") return XCircle;
  return ICON_MAP[configIcon] ?? FileText;
}

// Map visualization phase to the primary server phase for color lookup
const PHASE_TO_SERVER: Record<string, PipelinePhase> = {
  spec: "planning",
  plan: "planning",
  code: "coding",
  review: "reviewing",
  done: "completed",
};

const pulseTransition = {
  duration: 2,
  repeat: Infinity,
  ease: "easeInOut" as const,
};

export function PipelineNode({ config, state, isActive, iteration = 0 }: PipelineNodeProps) {
  const serverPhase = PHASE_TO_SERVER[config.phase] ?? null;
  const colors = getNodeColors(state, serverPhase);
  const Icon = getNodeIcon(state.status, config.icon);

  const pulseAnimation = isActive
    ? {
        scale: [1, 1.05, 1],
        boxShadow: [
          `0 0 0 0 ${colors.glow}`,
          `0 0 0 8px ${colors.glow}`,
          `0 0 0 0 ${colors.glow}`,
        ],
      }
    : {};

  const showIterationBadge = config.phase === "code" && iteration > 0 && state.status === "active";

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      data-testid={`pipeline-node-${config.phase}`}
    >
      <div className="relative">
        <motion.div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border-2",
            colors.bg
          )}
          style={{ borderColor: colors.border }}
          animate={isActive ? { ...pulseAnimation, borderColor: colors.border } : { borderColor: colors.border }}
          transition={isActive ? pulseTransition : { duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={state.status}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Icon className={cn("h-5 w-5", colors.text)} aria-hidden="true" />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {showIterationBadge && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white"
            data-testid={`pipeline-node-${config.phase}-iteration`}
          >
            {iteration}
          </span>
        )}
      </div>

      <span
        className={cn("hidden text-xs font-medium md:inline", colors.text)}
        data-testid={`pipeline-node-${config.phase}-label`}
      >
        {config.label}
      </span>

      <PipelineTimer phase={config.phase} state={state} />
    </div>
  );
}
