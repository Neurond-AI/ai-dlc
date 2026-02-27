"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, RefreshCw, StopCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePipeline } from "@/hooks/use-pipeline";

interface ErrorNotificationProps {
  taskId: string;
}

export function ErrorNotification({ taskId }: ErrorNotificationProps) {
  const {
    pipelineRun,
    retryPipeline,
    cancelPipeline,
    isRetrying,
    isCancelling,
  } = usePipeline({ taskId });

  const [isDismissed, setIsDismissed] = useState(false);

  const errorDetails = pipelineRun?.errorDetails;
  const isPaused = pipelineRun?.status === "paused";
  const isVisible = isPaused && errorDetails !== null && !isDismissed;

  const retryCount = errorDetails?.retryCount ?? 0;
  const maxRetries = errorDetails?.maxRetries ?? 3;
  const canRetry = retryCount < maxRetries;

  // Show toast when error appears
  useEffect(() => {
    if (isPaused && errorDetails) {
      setIsDismissed(false);

      const agentLabel = errorDetails.failedAgent
        ? ` (${errorDetails.failedAgent} agent)`
        : "";

      toast.error(`Pipeline Error${agentLabel}`, {
        description: errorDetails.message,
        duration: 10_000,
        action: canRetry
          ? {
              label: "Retry",
              onClick: () => retryPipeline(),
            }
          : undefined,
      });
    }
  }, [isPaused, errorDetails, canRetry, retryPipeline]);

  if (!isVisible) return null;

  const agentLabel = errorDetails?.failedAgent
    ? `Agent: ${capitalize(errorDetails.failedAgent)}`
    : null;
  const phaseLabel = errorDetails?.failedPhase
    ? `Phase: ${capitalize(errorDetails.failedPhase)}`
    : null;
  const retryLabel = `Retry ${retryCount}/${maxRetries}`;

  return (
    <Alert
      variant="destructive"
      className="relative"
      data-testid="pipeline-error-notification"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="pr-8">Pipeline Error</AlertTitle>
      <AlertDescription className="space-y-3">
        <p data-testid="pipeline-error-message">{errorDetails?.message}</p>

        {(agentLabel || phaseLabel) && (
          <p className="text-xs text-red-400 space-x-2">
            {agentLabel && <span data-testid="pipeline-error-agent">{agentLabel}</span>}
            {agentLabel && phaseLabel && <span>|</span>}
            {phaseLabel && <span data-testid="pipeline-error-phase">{phaseLabel}</span>}
            <span data-testid="pipeline-error-retry-count">| {retryLabel}</span>
          </p>
        )}

        <div className="flex items-center gap-2">
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={retryPipeline}
              disabled={isRetrying}
              className="border-red-300 text-red-700 hover:bg-red-50"
              data-testid="pipeline-error-retry-btn"
            >
              {isRetrying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={cancelPipeline}
            disabled={isCancelling}
            className="text-red-700 hover:bg-red-50"
            data-testid="pipeline-error-cancel-btn"
          >
            {isCancelling ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <StopCircle className="h-3 w-3 mr-1" />
            )}
            {isCancelling ? "Cancelling..." : "Cancel Pipeline"}
          </Button>
        </div>
      </AlertDescription>

      {/* Dismiss button */}
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors"
        aria-label="Dismiss error"
        data-testid="pipeline-error-dismiss-btn"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
