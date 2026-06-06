import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Small helpers so route handlers stay short and errors are consistent.
export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}

// Wraps a handler, turning Zod and thrown errors into clean JSON responses.
export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return badRequest("Validation failed", err.issues);
    }
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : "";
    if (status === 429 || /rate[_ ]?limit/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Anthropic rate limit reached. Your account is on a low usage tier - it will retry; for full-speed runs raise your tier in the Anthropic console.",
          code: "rate_limit",
        },
        { status: 429 },
      );
    }
    return serverError(err);
  }
}
