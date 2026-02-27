"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ConnectorStatus } from "@/types/pipeline-ui";

interface PipelineConnectorProps {
  status: ConnectorStatus;
  color: string;
}

export function PipelineConnector({ status, color }: PipelineConnectorProps) {
  const fillWidth =
    status === "filled" ? "100%" :
    status === "filling" ? "100%" :
    "0%";

  const fillTransition =
    status === "filling"
      ? { duration: 0.8, ease: "easeOut" as const }
      : { duration: 0.3 };

  return (
    <div
      className="relative h-0.5 flex-1 bg-muted mx-1"
      data-testid="pipeline-connector"
      role="presentation"
    >
      <motion.div
        className="absolute inset-y-0 left-0 h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: "0%" }}
        animate={{ width: fillWidth }}
        transition={fillTransition}
      />
    </div>
  );
}
