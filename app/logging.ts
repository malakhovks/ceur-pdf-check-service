export type LogLevel = "info" | "warn" | "error";

type LogPrimitive = string | number | boolean | null;
type LogValue = LogPrimitive | LogValue[] | { [key: string]: LogValue };

export type LogFields = Record<string, unknown>;

export type AppLogger = {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
};

function normalizeLogValue(value: unknown): LogValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return normalizeLogFields(errorLogFields(value));
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeLogValue(item) ?? null);
  }

  if (typeof value === "object") {
    return normalizeLogFields(value as LogFields);
  }

  return String(value);
}

function normalizeLogFields(fields: LogFields): Record<string, LogValue> {
  const normalized: Record<string, LogValue> = {};

  for (const [key, value] of Object.entries(fields)) {
    const logValue = normalizeLogValue(value);
    if (logValue !== undefined) {
      normalized[key] = logValue;
    }
  }

  return normalized;
}

export function errorLogFields(error: unknown): LogFields {
  if (error instanceof Error) {
    const fields: LogFields = {
      errorName: error.name,
      errorMessage: error.message,
    };

    if ("code" in error) {
      fields.errorCode = String((error as { code?: unknown }).code);
    }

    return fields;
  }

  return {
    errorMessage: String(error),
  };
}

export function createConsoleLogger(now = () => new Date()): AppLogger {
  const write = (level: LogLevel, event: string, fields: LogFields = {}) => {
    const safeFields = normalizeLogFields(fields);
    delete safeFields.timestamp;
    delete safeFields.level;
    delete safeFields.event;

    console[level](JSON.stringify({
      timestamp: now().toISOString(),
      level,
      event,
      ...safeFields,
    }));
  };

  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}

export const logger = createConsoleLogger();
