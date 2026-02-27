"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useTaskStore } from "@/stores/task-store";
import { buildFileTree, computeDiffs } from "@/lib/services/diff-service";
import type { FileTreeNode, UnifiedDiff } from "@/types/diff";
import { FileTree } from "./file-tree";
import { DiffViewer } from "./diff-viewer";
import { ReviewActions } from "./review-actions";
import { SuccessAnimation } from "./success-animation";

interface DiffReviewPanelProps {
  taskId: string;
}

function findFirstFile(nodes: FileTreeNode[]): FileTreeNode | null {
  for (const node of nodes) {
    if (node.type === "file") return node;
    if (node.children) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

export function DiffReviewPanel({ taskId }: DiffReviewPanelProps) {
  const pipelineRun = usePipelineStore((s) => s.getPipelineRun(taskId));
  const tasks = useTaskStore((s) => s.tasks);
  const task = tasks.find((t) => t.id === taskId) ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [diffs, setDiffs] = useState<Map<string, UnifiedDiff>>(new Map());
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const isVisible =
    task?.status === "review" && pipelineRun?.fileChanges != null;

  useEffect(() => {
    if (pipelineRun?.fileChanges) {
      const tree = buildFileTree(pipelineRun.fileChanges);
      const computed = computeDiffs(pipelineRun.fileChanges);
      setFileTree(tree);
      setDiffs(computed);
      const firstFile = findFirstFile(tree);
      if (firstFile) setSelectedFilePath(firstFile.path);
    }
  }, [pipelineRun?.fileChanges]);

  useEffect(() => {
    setIsOpen(isVisible);
  }, [isVisible]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleApproveSuccess = useCallback(() => {
    setIsOpen(false);
    setShowSuccessAnimation(true);
  }, []);

  const selectedDiff = selectedFilePath ? diffs.get(selectedFilePath) ?? null : null;
  const fileCount = pipelineRun?.fileChanges?.files.length ?? 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              data-testid="diff-review-backdrop"
            />

            {/* Panel */}
            <motion.div
              className="fixed right-0 top-0 z-50 flex h-full flex-col bg-background shadow-2xl"
              style={{ width: "min(80vw, 1200px)" }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              data-testid="diff-review-panel"
              aria-label="Code Review Panel"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Files className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">Code Review</h2>
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid="diff-review-file-count"
                  >
                    {fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-7 w-7 p-0"
                  data-testid="diff-review-close-btn"
                  aria-label="Close review panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Main content */}
              <div className="flex flex-1 overflow-hidden">
                {/* File tree */}
                <div
                  className="w-60 flex-shrink-0 overflow-y-auto border-r"
                  data-testid="diff-review-file-tree-container"
                >
                  <FileTree
                    tree={fileTree}
                    selectedFilePath={selectedFilePath}
                    onSelectFile={setSelectedFilePath}
                  />
                </div>

                <Separator orientation="vertical" />

                {/* Diff viewer */}
                <div className="flex-1 overflow-hidden" data-testid="diff-review-viewer-container">
                  <DiffViewer diff={selectedDiff} />
                </div>
              </div>

              {/* Review actions bottom bar */}
              <div className="border-t">
                <ReviewActions
                  taskId={taskId}
                  onClose={handleClose}
                  onApproveSuccess={handleApproveSuccess}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SuccessAnimation
        isVisible={showSuccessAnimation}
        onComplete={() => setShowSuccessAnimation(false)}
      />
    </>
  );
}
