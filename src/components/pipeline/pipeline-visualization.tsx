"use client";

import React, { Fragment } from "react";
import { usePipelineVisualization } from "@/hooks/use-pipeline-visualization";
import { PIPELINE_NODES } from "@/lib/constants/pipeline-nodes";
import { PipelineNode } from "./pipeline-node";
import { PipelineConnector } from "./pipeline-connector";
import type { PipelineNodeState, ConnectorStatus } from "@/types/pipeline-ui";

interface PipelineVisualizationProps {
  taskId: string;
}

function deriveConnectorStatus(
  leftNode: PipelineNodeState,
  rightNode: PipelineNodeState
): ConnectorStatus {
  if (rightNode.status === "completed" || rightNode.status === "failed") return "filled";
  if (rightNode.status === "active") return "filling";
  return "empty";
}

function getConnectorColor(rightNode: PipelineNodeState): string {
  switch (rightNode.status) {
    case "completed":
      return "#22C55E";
    case "active":
      // Use the phase color for active nodes
      return "#3B82F6";
    case "failed":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export function PipelineVisualization({ taskId }: PipelineVisualizationProps) {
  const { nodes, iteration } = usePipelineVisualization({ taskId });

  return (
    <div
      className="flex items-center justify-between gap-0 px-2 py-4"
      data-testid="pipeline-visualization"
      aria-label="Pipeline stages"
    >
      {nodes.map((node, index) => (
        <Fragment key={node.phase}>
          <PipelineNode
            config={PIPELINE_NODES[index]}
            state={node}
            isActive={node.status === "active"}
            iteration={node.phase === "code" ? iteration : 0}
          />
          {index < nodes.length - 1 && (
            <PipelineConnector
              status={deriveConnectorStatus(nodes[index], nodes[index + 1])}
              color={getConnectorColor(nodes[index + 1])}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
