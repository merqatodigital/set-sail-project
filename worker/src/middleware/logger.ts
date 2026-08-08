// Structured logging middleware.
// Logs request metadata without exposing secrets or sensitive data.

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter++;
  const ts = Date.now().toString(36);
  const seq = requestCounter.toString(36);
  return `${ts}-${seq}`;
}

export interface RequestContext {
  requestId: string;
  route: string;
  method: string;
  userId: string | null;
  tenantId: string | null;
  startTime: number;
}

export function createRequestContext(
  request: Request,
  route: string,
  userId: string | null,
  tenantId: string | null,
): RequestContext {
  return {
    requestId: generateRequestId(),
    route,
    method: request.method,
    userId,
    tenantId,
    startTime: Date.now(),
  };
}

export function logRequest(ctx: RequestContext, status: number): void {
  const duration = Date.now() - ctx.startTime;
  const log = {
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    requestId: ctx.requestId,
    route: ctx.route,
    method: ctx.method,
    status,
    duration,
    userId: ctx.userId ?? "anonymous",
    tenantId: ctx.tenantId ?? "none",
  };
  if (status >= 500) {
    console.error(JSON.stringify(log));
  } else if (status >= 400) {
    console.warn(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
}
