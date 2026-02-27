// Lazy-loaded Shiki singleton for syntax highlighting (BR-06-008)

export const SUPPORTED_LANGUAGES = new Set([
  "typescript",
  "javascript",
  "json",
  "css",
  "html",
  "markdown",
  "python",
  "yaml",
  "tsx",
  "jsx",
]);

// Language normalization map
const LANG_MAP: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  json: "json",
  css: "css",
  html: "html",
  markdown: "markdown",
  python: "python",
  yaml: "yaml",
  tsx: "tsx",
  jsx: "jsx",
  ts: "typescript",
  js: "javascript",
  py: "python",
  yml: "yaml",
  md: "markdown",
};

export function normalizeLanguage(lang: string): string {
  return LANG_MAP[lang.toLowerCase()] ?? lang.toLowerCase();
}

export function isLanguageSupported(lang: string): boolean {
  return SUPPORTED_LANGUAGES.has(normalizeLanguage(lang));
}

// Highlighter type (using dynamic import to avoid SSR issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShikiHighlighter = any;

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

export async function getShikiHighlighter(): Promise<ShikiHighlighter | null> {
  if (typeof window === "undefined") return null;

  if (!highlighterPromise) {
    highlighterPromise = import("shiki")
      .then(({ createHighlighter }) =>
        createHighlighter({
          themes: ["github-dark", "github-light"],
          langs: [
            "typescript",
            "javascript",
            "json",
            "css",
            "html",
            "markdown",
            "python",
            "yaml",
            "tsx",
            "jsx",
          ],
        })
      )
      .catch(() => null);
  }

  return highlighterPromise;
}

export interface HighlightedToken {
  content: string;
  color?: string;
}

export function highlightLine(
  highlighter: ShikiHighlighter | null,
  content: string,
  language: string,
  isDark: boolean
): HighlightedToken[] | null {
  if (!highlighter || !isLanguageSupported(language)) return null;

  try {
    const lang = normalizeLanguage(language);
    const theme = isDark ? "github-dark" : "github-light";
    const tokens = highlighter.codeToTokensBase(content, { lang, theme });
    if (!tokens || tokens.length === 0) return null;
    // codeToTokensBase returns array of lines, each line is array of tokens
    return tokens[0]?.map((t: { content: string; color?: string }) => ({
      content: t.content,
      color: t.color,
    })) ?? null;
  } catch {
    return null;
  }
}
