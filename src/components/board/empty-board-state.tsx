"use client";

import React from "react";
import { motion } from "framer-motion";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

export function EmptyBoardState() {
  const openTaskModal = useUIStore((s) => s.openTaskModal);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 py-16"
      data-testid="empty-board-state"
    >
      <ClipboardList className="h-16 w-16 text-muted-foreground/40" />
      <div className="text-center">
        <h2 className="text-xl font-semibold">No tasks yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Create your first task to get started with AI-powered development.
        </p>
      </div>
      <Button
        onClick={openTaskModal}
        data-testid="empty-board-create-btn"
      >
        <Plus className="h-4 w-4" />
        Create your first task
      </Button>
    </motion.div>
  );
}
