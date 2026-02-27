type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  correlationId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // Remove PII fields
  const piiFields = ["password", "token", "secret", "authorization", "cookie"];
  for (const field of piiFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  // Truncate email to domain only
  if (typeof sanitized.email === "string") {
    const parts = sanitized.email.split("@");
    sanitized.email = parts.length > 1 ? `***@${parts[1]}` : "[REDACTED]";
  }

  return sanitized;
}

function log(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    level,
    message,
    metadata: sanitizeMetadata(metadata),
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (message: string, metadata?: Record<string, unknown>) =>
    log("info", message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    log("warn", message, metadata),
  error: (message: string, metadata?: Record<string, unknown>) =>
    log("error", message, metadata),
};
