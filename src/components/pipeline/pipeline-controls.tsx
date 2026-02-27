"use client";

import { useState } from "react";
import { Loader2, Play, StopCircle, RefreshCw, CheckCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePipeline } from "@/hooks/use-pipeline";
import type { TaskStatus } from "@/types/task";

interface PipelineControlsProps {
  taskId: string;
  taskStatus?: TaskStatus;
}

export function PipelineControls({ taskId, taskStatus }: PipelineControlsProps) {
  const {
    pipelineRun,
    startPipeline,
    cancelPipeline,
    retryPipeline,
    approvePipeline,
    requestChanges,
    isStarting,
    isCancelling,
    isRetrying,
    isApproving,
    isRequestingChanges,
    actionError,
    clearActionError,
  } = usePipeline({ taskId });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [feedback, setFeedback] = useState("");

  const status = pipelineRun?.status;
  const phase = pipelineRun?.phase;

  // Determine what to show
  const isIdle = !pipelineRun || status === "cancelled";
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isPassed = status === "passed";
  const isFailed = status === "failed" || phase === "failed";

  const canStart =
    !taskStatus ||
    taskStatus === "backlog" ||
    taskStatus === "spec";

  const retryCount = pipelineRun?.errorDetails?.retryCount ?? 0;
  const maxRetries = pipelineRun?.errorDetails?.maxRetries ?? 3;
  const canRetry = retryCount < maxRetries;

  const handleSubmitChanges = async () => {
    if (!feedback.trim()) return;
    await requestChanges(feedback.trim());
    setFeedback("");
    setShowChangesDialog(false);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2" data-testid="pipeline-controls">
        {/* Error message */}
        {actionError && (
          <div
            className="w-full text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
            data-testid="pipeline-action-error"
          >
            {actionError}
            <button
              onClick={clearActionError}
              className="ml-2 text-red-400 hover:text-red-600"
              data-testid="pipeline-error-dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Start Pipeline — shown when idle or cancelled */}
        {isIdle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={startPipeline}
                  disabled={isStarting || !canStart}
                  data-testid="pipeline-start-btn"
                  size="sm"
                >
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isStarting ? "Starting..." : "Start Pipeline"}
                </Button>
              </span>
            </TooltipTrigger>
            {!canStart && (
              <TooltipContent>
                Pipeline can only start on tasks in Backlog or Spec status
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Cancel — shown when running */}
        {isRunning && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling}
              data-testid="pipeline-cancel-btn"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4 mr-2" />
              )}
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          </>
        )}

        {/* Retry + Cancel — shown when paused (error state) */}
        {isPaused && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={retryPipeline}
                    disabled={isRetrying || !canRetry}
                    size="sm"
                    data-testid="pipeline-retry-btn"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isRetrying ? "Retrying..." : `Retry (${retryCount}/${maxRetries})`}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canRetry && (
                <TooltipContent>Maximum retry attempts reached</TooltipContent>
              )}
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling}
              data-testid="pipeline-cancel-paused-btn"
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4 mr-2" />
              )}
              Cancel
            </Button>
          </>
        )}

        {/* Approve + Request Changes — shown when passed (in review) */}
        {isPassed && (
          <>
            <Button
              onClick={approvePipeline}
              disabled={isApproving}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              data-testid="pipeline-approve-btn"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {isApproving ? "Approving..." : "Approve"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChangesDialog(true)}
              disabled={isRequestingChanges}
              data-testid="pipeline-request-changes-btn"
            >
              {isRequestingChanges ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              Request Changes
            </Button>
          </>
        )}

        {/* Retry Pipeline — shown when failed */}
        {isFailed && (
          <Button
            onClick={startPipeline}
            disabled={isStarting}
            size="sm"
            data-testid="pipeline-retry-failed-btn"
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {isStarting ? "Starting..." : "Retry Pipeline"}
          </Button>
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Pipeline?</AlertDialogTitle>
              <AlertDialogDescription>
                This will stop the current pipeline run and move the task back to
                Backlog. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="pipeline-cancel-dialog-cancel">
                Keep Running
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowCancelDialog(false);
                  cancelPipeline();
                }}
                data-testid="pipeline-cancel-dialog-confirm"
                className="bg-red-600 hover:bg-red-700"
              >
                Cancel Pipeline
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Request Changes Dialog */}
        <AlertDialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Request Changes</AlertDialogTitle>
              <AlertDialogDescription>
                Describe the changes you want made. The pipeline will re-run with
                your feedback as additional context.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="E.g., Add input validation, fix the error handling in the API route..."
                className="min-h-[100px]"
                data-testid="pipeline-changes-feedback"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="pipeline-changes-dialog-cancel">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmitChanges}
                disabled={!feedback.trim() || isRequestingChanges}
                data-testid="pipeline-changes-dialog-submit"
              >
                {isRequestingChanges ? "Submitting..." : "Request Changes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
