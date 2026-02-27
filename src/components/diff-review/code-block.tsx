"use client";

import { cn } from "@/lib/utils";
import type { DiffLineType } from "@/types/diff";
import {
  highlightLine,
  isLanguageSupported,
  normalizeLanguage,
} from "@/lib/services/syntax-highlighter";

interface CodeBlockProps {
  content: string;
  language: string;
  lineType: DiffLineType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlighter: any | null;
}

export function CodeBlock({ content, language, lineType, highlighter }: CodeBlockProps) {
  const bgClass = {
    added: "bg-emerald-50 dark:bg-emerald-950/20",
    removed: "bg-red-50 dark:bg-red-950/20",
    unchanged: "bg-transparent",
  }[lineType];

  const supported = isLanguageSupported(language);
  const tokens = supported && highlighter
    ? highlightLine(highlighter, content, normalizeLanguage(language), false)
    : null;

  return (
    <pre
      className={cn(
        "min-h-[20px] whitespace-pre font-mono text-sm leading-5",
        bgClass
      )}
      data-testid="code-block"
    >
      {tokens ? (
        tokens.map((token, i) => (
          <span key={i} style={{ color: token.color }}>
            {token.content}
          </span>
        ))
      ) : (
        <span>{content}</span>
      )}
    </pre>
  );
}
