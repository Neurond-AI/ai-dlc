"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MessageSquare, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { usePipeline } from "@/hooks/use-pipeline";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useTaskStore } from "@/stores/task-store";
import { RequestChangesForm } from "./request-changes-form";

interface ReviewActionsProps {
  taskId: string;
  onClose: () => void;
  onApproveSuccess: () => void;
}

export function ReviewActions({ taskId, onClose, onApproveSuccess }: ReviewActionsProps) {
  const {
    approvePipeline,
    requestChanges,
    retryPipeline,
    isApproving,
    isRequestingChanges,
    isRetrying,
    actionError,
    clearActionError,
  } = usePipeline({ taskId });

  const pipelineRun = usePipelineStore((s) => s.getPipelineRun(taskId));
  const tasks = useTaskStore((s) => s.tasks);
  const task = tasks.find((t) => t.id === taskId);

  const [showRequestChangesForm, setShowRequestChangesForm] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);

  // Track pending action to determine success/error
  const pendingAction = useRef<"approve" | "request" | "retry" | null>(null);
  const prevApproving = useRef(false);
  const prevRequesting = useRef(false);
  const prevRetrying = useRef(false);

  const isAnyLoading = isApproving || isRequestingChanges || isRetrying;
  const reviewScore = pipelineRun?.reviewFindings?.score;

  // Detect when approve completes
  useEffect(() => {
    if (prevApproving.current && !isApproving && pendingAction.current === "approve") {
      if (!actionError) {
        toast.success(`Task "${task?.title ?? "Task"}" approved and completed`);
        onApproveSuccess();
      } else {
        toast.error(actionError);
      }
      pendingAction.current = null;
      clearActionError();
    }
    prevApproving.current = isApproving;
  });

  // Detect when request-changes completes
  useEffect(() => {
    if (prevRequesting.current && !isRequestingChanges && pendingAction.current === "request") {
      if (!actionError) {
        toast.success("Feedback sent — pipeline restarting from Code phase");
        setShowRequestChangesForm(false);
        onClose();
      } else {
        toast.error(actionError);
      }
      pendingAction.current = null;
      clearActionError();
    }
    prevRequesting.current = isRequestingChanges;
  });

  // Detect when retry completes
  useEffect(() => {
    if (prevRetrying.current && !isRetrying && pendingAction.current === "retry") {
      if (!actionError) {
        toast.success("Pipeline restarting from Planning phase");
        onClose();
      } else {
        toast.error(actionError);
      }
      pendingAction.current = null;
      clearActionError();
    }
    prevRetrying.current = isRetrying;
  });

  const handleApprove = async () => {
    pendingAction.current = "approve";
    clearActionError();
    await approvePipeline();
  };

  const handleRequestChanges = async (feedback: string) => {
    pendingAction.current = "request";
    clearActionError();
    await requestChanges(feedback);
  };

  const handleConfirmRetry = async () => {
    pendingAction.current = "retry";
    clearActionError();
    setShowRetryConfirm(false);
    await retryPipeline();
  };

  return (
    <div className="space-y-3 p-4" data-testid="review-actions">
      {/* Review score */}
      {reviewScore !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Review Score</span>
          <span
            className="text-sm font-semibold"
            data-testid="review-score"
          >
            {reviewScore}/100
          </span>
        </div>
      )}

      {/* Request Changes Form (expandable) */}
      <AnimatePresence>
        {showRequestChangesForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <RequestChangesForm
              onSubmit={handleRequestChanges}
              onCancel={() => setShowRequestChangesForm(false)}
              isSubmitting={isRequestingChanges}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Approve */}
        <Button
          onClick={handleApprove}
          disabled={isAnyLoading}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          aria-busy={isApproving}
          data-testid="review-approve-btn"
        >
          {isApproving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-label="Loading" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {isApproving ? "Approving..." : "Approve"}
        </Button>

        {/* Request Changes */}
        <Button
          variant="outline"
          onClick={() => setShowRequestChangesForm((v) => !v)}
          disabled={isAnyLoading}
          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
          aria-busy={isRequestingChanges}
          data-testid="review-request-changes-btn"
        >
          {isRequestingChanges ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-label="Loading" />
          ) : (
            <MessageSquare className="mr-2 h-4 w-4" />
          )}
          {isRequestingChanges ? "Sending..." : "Request Changes"}
        </Button>

        {/* Retry */}
        <Button
          variant="ghost"
          onClick={() => setShowRetryConfirm(true)}
          disabled={isAnyLoading}
          aria-busy={isRetrying}
          data-testid="review-retry-btn"
        >
          {isRetrying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-label="Loading" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {isRetrying ? "Restarting..." : "Retry"}
        </Button>
      </div>

      {/* Retry confirmation dialog */}
      <AlertDialog open={showRetryConfirm} onOpenChange={setShowRetryConfirm}>
        <AlertDialogContent data-testid="retry-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              Retry will restart the entire pipeline from the Planning stage.
              Current code changes will be discarded. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="retry-cancel-btn">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRetry}
              data-testid="retry-confirm-btn"
            >
              Confirm Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
