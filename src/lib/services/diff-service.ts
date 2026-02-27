import { diffLines } from "diff";
import type { FileChanges, FileChange } from "@/types/agent";
import type {
  DiffFile,
  DiffHunk,
  DiffLine,
  DiffLineType,
  FileTreeNode,
  UnifiedDiff,
} from "@/types/diff";

const MAX_LINES = 10_000;
const CONTEXT_LINES = 3;

// -- Path sanitization (BR-06-009, security) --

export function sanitizeFilePath(path: string): string {
  // Remove null bytes
  let sanitized = path.replace(/\0/g, "");
  // Prevent path traversal
  sanitized = sanitized.replace(/\.\.\//g, "").replace(/\.\.\\/g, "");
  // Remove potential XSS characters from display (keep alphanumeric, slash, dot, dash, underscore)
  sanitized = sanitized.replace(/[<>"'&]/g, "");
  return sanitized;
}

// -- Build File Tree from FileChanges (BR-06-007) --

export function buildFileTree(fileChanges: FileChanges): FileTreeNode[] {
  // Flat map of all nodes by path for easy lookup
  const nodeMap = new Map<string, FileTreeNode>();

  const getOrCreateDir = (path: string, name: string): FileTreeNode => {
    if (!nodeMap.has(path)) {
      nodeMap.set(path, { name, path, type: "directory", children: [] });
    }
    return nodeMap.get(path)!;
  };

  for (const file of fileChanges.files) {
    const safePath = sanitizeFilePath(file.filePath);
    const segments = safePath.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    // Ensure all parent directories exist
    for (let i = 0; i < segments.length - 1; i++) {
      const dirPath = segments.slice(0, i + 1).join("/");
      getOrCreateDir(dirPath, segments[i]);
    }

    // Add file node
    nodeMap.set(safePath, {
      name: segments[segments.length - 1],
      path: safePath,
      type: "file",
      language: file.language,
      action: file.action,
    });
  }

  // Wire up parent-child relationships
  for (const [path, node] of nodeMap) {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) continue; // root-level node
    const parentPath = path.slice(0, lastSlash);
    const parent = nodeMap.get(parentPath);
    if (parent && parent.type === "directory" && parent.children) {
      if (!parent.children.find((c) => c.path === path)) {
        parent.children.push(node);
      }
    }
  }

  // Collect root-level nodes (paths with no slash)
  const roots: FileTreeNode[] = [];
  for (const [path, node] of nodeMap) {
    if (!path.includes("/")) roots.push(node);
  }

  return sortNodes(roots);
}

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const sorted = nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of sorted) {
    if (node.type === "directory" && node.children) {
      node.children = sortNodes(node.children);
    }
  }
  return sorted;
}

// -- Compute Diffs from FileChanges --

export function computeDiffs(fileChanges: FileChanges): Map<string, UnifiedDiff> {
  const result = new Map<string, UnifiedDiff>();

  for (const file of fileChanges.files) {
    const safePath = sanitizeFilePath(file.filePath);
    const diffFile = toAbstractDiffFile(file);
    const unified = computeFileDiff(diffFile);
    result.set(safePath, { ...unified, filePath: safePath });
  }

  return result;
}

function toAbstractDiffFile(file: FileChange): DiffFile {
  if (file.action === "create") {
    return {
      filePath: file.filePath,
      language: file.language,
      originalContent: null,
      newContent: file.content,
      action: "create",
    };
  }
  if (file.action === "delete") {
    return {
      filePath: file.filePath,
      language: file.language,
      originalContent: file.content,
      newContent: "",
      action: "delete",
    };
  }
  // modify: no original content available from single FileChange
  return {
    filePath: file.filePath,
    language: file.language,
    originalContent: null,
    newContent: file.content,
    action: "modify",
  };
}

function computeFileDiff(file: DiffFile): UnifiedDiff {
  const { filePath, language, action, originalContent, newContent } = file;

  if (action === "create" || (action === "modify" && originalContent === null)) {
    const lines = truncateLines(newContent.split("\n"));
    const hunk: DiffHunk = {
      oldStart: 0,
      oldCount: 0,
      newStart: 1,
      newCount: lines.length,
      lines: lines.map((content, i) => ({
        lineNumber: i + 1,
        content,
        type: "added" as const,
      })),
    };
    appendTruncationMarkerIfNeeded(hunk, newContent);
    return { filePath, language, hunks: [hunk] };
  }

  if (action === "delete") {
    const lines = truncateLines((originalContent ?? "").split("\n"));
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: lines.length,
      newStart: 0,
      newCount: 0,
      lines: lines.map((content, i) => ({
        lineNumber: i + 1,
        content,
        type: "removed" as const,
      })),
    };
    appendTruncationMarkerIfNeeded(hunk, originalContent ?? "");
    return { filePath, language, hunks: [hunk] };
  }

  // modify with both sides
  return computeModifyDiff(filePath, language, originalContent ?? "", newContent);
}

function truncateLines(lines: string[]): string[] {
  if (lines.length > MAX_LINES) return lines.slice(0, MAX_LINES);
  return lines;
}

function appendTruncationMarkerIfNeeded(hunk: DiffHunk, content: string): void {
  const totalLines = content.split("\n").length;
  if (totalLines > MAX_LINES) {
    hunk.lines.push({
      lineNumber: -1,
      content: "--- File truncated (>10,000 lines) ---",
      type: "unchanged",
    });
  }
}

function computeModifyDiff(
  filePath: string,
  language: string,
  original: string,
  modified: string
): UnifiedDiff {
  const changes = diffLines(original, modified);
  const rawLines: Array<{ content: string; type: DiffLineType; origLine?: number; newLine?: number }> = [];

  let oldLineNum = 1;
  let newLineNum = 1;

  for (const change of changes) {
    const lines = change.value.split("\n");
    // Remove trailing empty string from split
    if (lines[lines.length - 1] === "") lines.pop();

    if (change.added) {
      for (const line of lines) {
        rawLines.push({ content: line, type: "added", newLine: newLineNum++ });
      }
    } else if (change.removed) {
      for (const line of lines) {
        rawLines.push({ content: line, type: "removed", origLine: oldLineNum++ });
      }
    } else {
      for (const line of lines) {
        rawLines.push({ content: line, type: "unchanged", origLine: oldLineNum++, newLine: newLineNum++ });
      }
    }
  }

  // Truncate if necessary
  const truncated = rawLines.length > MAX_LINES;
  const workLines = truncated ? rawLines.slice(0, MAX_LINES) : rawLines;

  // Group into hunks with CONTEXT_LINES context
  const changedIndices = new Set<number>();
  for (let i = 0; i < workLines.length; i++) {
    if (workLines[i].type !== "unchanged") changedIndices.add(i);
  }

  const includedIndices = new Set<number>();
  for (const idx of changedIndices) {
    for (let c = Math.max(0, idx - CONTEXT_LINES); c <= Math.min(workLines.length - 1, idx + CONTEXT_LINES); c++) {
      includedIndices.add(c);
    }
  }

  if (includedIndices.size === 0) {
    return { filePath, language, hunks: [] };
  }

  const sortedIncluded = Array.from(includedIndices).sort((a, b) => a - b);
  const hunks: DiffHunk[] = [];
  let hunkStart = 0;

  while (hunkStart < sortedIncluded.length) {
    let hunkEnd = hunkStart;
    while (
      hunkEnd + 1 < sortedIncluded.length &&
      sortedIncluded[hunkEnd + 1] === sortedIncluded[hunkEnd] + 1
    ) {
      hunkEnd++;
    }

    const hunkLineIndices = sortedIncluded.slice(hunkStart, hunkEnd + 1);
    const hunkLines: DiffLine[] = hunkLineIndices.map((idx) => {
      const raw = workLines[idx];
      const lineNum = raw.type === "added"
        ? (raw.newLine ?? 0)
        : raw.type === "removed"
        ? (raw.origLine ?? 0)
        : (raw.origLine ?? 0);
      return { lineNumber: lineNum, content: raw.content, type: raw.type };
    });

    const firstIdx = hunkLineIndices[0];
    const lastIdx = hunkLineIndices[hunkLineIndices.length - 1];
    const oldLines = hunkLines.filter((l) => l.type !== "added");
    const newLines = hunkLines.filter((l) => l.type !== "removed");

    hunks.push({
      oldStart: workLines[firstIdx]?.origLine ?? 1,
      oldCount: oldLines.length,
      newStart: workLines[firstIdx]?.newLine ?? 1,
      newCount: newLines.length,
      lines: hunkLines,
    });

    void lastIdx;
    hunkStart = hunkEnd + 1;
  }

  if (truncated) {
    const lastHunk = hunks[hunks.length - 1];
    if (lastHunk) {
      lastHunk.lines.push({
        lineNumber: -1,
        content: "--- File truncated (>10,000 lines) ---",
        type: "unchanged",
      });
    }
  }

  return { filePath, language, hunks };
}
