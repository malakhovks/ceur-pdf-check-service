import { NextResponse } from "next/server";
import { logger as defaultLogger, type AppLogger } from "./app/logging";

export function authRequiredCheckResponse(requestId: string, pathname: string, logger: AppLogger = defaultLogger) {
  logger.warn("proxy.request.rejected", {
    requestId,
    pathname,
    reason: "authentication_required",
    status: 401,
  });

  return NextResponse.json(
    { requestId, status: "error", error: "Authentication required." },
    { status: 401 },
  );
}
