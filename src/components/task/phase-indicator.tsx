"use client";

import React from "react";
import { motion } from "framer-motion";
import { type PipelinePhase, PHASE_COLORS } from "@/types/task";

interface PhaseIndicatorProps {
  phase: PipelinePhase | null;
  size?: "sm" | "md";
}

const SIZE_MAP = {
  sm: 12,
  md: 20,
};

export function PhaseIndicator({ phase, size = "sm" }: PhaseIndicatorProps) {
  const color = PHASE_COLORS[phase ?? "idle"];
  const px = SIZE_MAP[size];

  return (
    <motion.div
      animate={{
        borderColor: color,
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 0.5 }}
      className="rounded-full border-2 flex-shrink-0"
      style={{ width: px, height: px, borderColor: color }}
      data-testid="phase-indicator"
      aria-label={`Pipeline phase: ${phase ?? "idle"}`}
    />
  );
}
