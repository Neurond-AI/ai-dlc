"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Folder,
  FileCode2,
  FileJson,
  FileText,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileTreeNode } from "@/types/diff";

interface FileTreeProps {
  tree: FileTreeNode[];
  selectedFilePath: string | null;
  onSelectFile: (filePath: string) => void;
}

interface ActionBadgeProps {
  action: "create" | "modify" | "delete";
}

function ActionBadge({ action }: ActionBadgeProps) {
  const config = {
    create: {
      label: "A",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    modify: {
      label: "M",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    delete: {
      label: "D",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
  }[action];

  return (
    <span
      className={cn(
        "flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
        config.className
      )}
      aria-label={action === "create" ? "Added" : action === "modify" ? "Modified" : "Deleted"}
    >
      {config.label}
    </span>
  );
}

function FileIcon({
  language,
  className,
}: {
  language?: string;
  className?: string;
}) {
  const lang = language?.toLowerCase() ?? "";
  if (lang === "json") return <FileJson className={className} />;
  if (lang === "html") return <FileCode className={className} />;
  if (
    lang === "typescript" ||
    lang === "javascript" ||
    lang === "python" ||
    lang === "tsx" ||
    lang === "jsx"
  ) {
    return <FileCode2 className={className} />;
  }
  return <FileText className={className} />;
}

interface FileTreeNodeComponentProps {
  node: FileTreeNode;
  depth: number;
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}

function FileTreeNodeComponent({
  node,
  depth,
  selectedFilePath,
  onSelectFile,
  expandedPaths,
  onToggle,
}: FileTreeNodeComponentProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedFilePath;

  if (node.type === "directory") {
    return (
      <div role="treeitem" aria-expanded={isExpanded}>
        <button
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          data-testid={`file-tree-dir-${node.path}`}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${node.name}`}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
          <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && node.children && (
            <motion.div
              role="group"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ overflow: "hidden" }}
            >
              {node.children.map((child) => (
                <FileTreeNodeComponent
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  selectedFilePath={selectedFilePath}
                  onSelectFile={onSelectFile}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      role="treeitem"
      aria-selected={isSelected}
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded py-1 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/50 text-foreground"
      )}
      data-testid={`file-tree-file-${node.path}`}
      aria-label={`${node.name} - ${node.action ?? "file"}`}
    >
      <FileIcon
        language={node.language}
        className="h-4 w-4 flex-shrink-0 text-muted-foreground"
      />
      <span className="flex-1 truncate text-left">{node.name}</span>
      {node.action && <ActionBadge action={node.action} />}
    </button>
  );
}

export function FileTree({ tree, selectedFilePath, onSelectFile }: FileTreeProps) {
  // Auto-expand all root-level directories on mount
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const paths = new Set<string>();
    tree.forEach((node) => {
      if (node.type === "directory") paths.add(node.path);
    });
    return paths;
  });

  const treeRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No file changes to review.
      </div>
    );
  }

  return (
    <div
      ref={treeRef}
      role="tree"
      className="p-1"
      aria-label="Changed files"
      data-testid="file-tree"
    >
      {tree.map((node) => (
        <FileTreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedFilePath={selectedFilePath}
          onSelectFile={onSelectFile}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
