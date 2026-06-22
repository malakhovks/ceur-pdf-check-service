import type { AppLogger, LogFields, LogLevel } from "../app/logging";

export type CapturedLog = {
  level: LogLevel;
  event: string;
  fields: LogFields;
};

export function createMemoryLogger(logs: CapturedLog[]): AppLogger {
  const push = (level: LogLevel, event: string, fields: LogFields = {}) => {
    logs.push({ level, event, fields });
  };

  return {
    info: (event, fields) => push("info", event, fields),
    warn: (event, fields) => push("warn", event, fields),
    error: (event, fields) => push("error", event, fields),
  };
}

export function findLog(logs: CapturedLog[], event: string, fields: LogFields = {}) {
  return logs.find((log) => {
    if (log.event !== event) {
      return false;
    }

    return Object.entries(fields).every(([key, value]) => log.fields[key] === value);
  });
}
