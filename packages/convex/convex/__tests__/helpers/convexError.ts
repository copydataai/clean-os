import { expect } from "vitest";

export function getConvexErrorCode(error: unknown): string | null {
  const parseMessageCode = (message: string): string | null => {
    if (/^[A-Z0-9_]+$/.test(message)) {
      return message;
    }
    try {
      const parsed = JSON.parse(message) as { code?: unknown };
      return typeof parsed?.code === "string" ? parsed.code : null;
    } catch {
      return null;
    }
  };

  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const code = (data as { code?: unknown }).code;
      if (typeof code === "string") {
        return code;
      }
    }
  }

  if (error instanceof Error) {
    return parseMessageCode(error.message);
  }

  return null;
}

export async function expectConvexErrorCode(
  promise: Promise<unknown>,
  expectedCode: string
) {
  try {
    await promise;
    expect.fail(`Expected Convex error with code ${expectedCode}`);
  } catch (error) {
    expect(getConvexErrorCode(error)).toBe(expectedCode);
  }
}
