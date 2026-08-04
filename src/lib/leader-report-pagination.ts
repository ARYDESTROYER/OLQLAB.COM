const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 512;
const MAX_SESSION_ID_LENGTH = 191;

export type LeaderReportCursor = {
  sessionId: string;
  submittedAt: Date | null;
};

type LeaderReportCursorPayload = {
  v: typeof CURSOR_VERSION;
  sessionId: string;
  submittedAt: string | null;
};

export class InvalidLeaderReportCursorError extends Error {
  constructor() {
    super("Invalid leader report pagination cursor.");
    this.name = "InvalidLeaderReportCursorError";
  }
}

export function encodeLeaderReportCursor(cursor: LeaderReportCursor) {
  const payload: LeaderReportCursorPayload = {
    v: CURSOR_VERSION,
    sessionId: cursor.sessionId,
    submittedAt: cursor.submittedAt?.toISOString() || null,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeLeaderReportCursor(value: string | null) {
  if (value === null) return null;
  if (value.length === 0 || value.length > MAX_CURSOR_LENGTH) {
    throw new InvalidLeaderReportCursorError();
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidLeaderReportCursorError();
    }

    const payload = parsed as Partial<LeaderReportCursorPayload>;
    if (
      payload.v !== CURSOR_VERSION ||
      typeof payload.sessionId !== "string" ||
      payload.sessionId.length === 0 ||
      payload.sessionId.length > MAX_SESSION_ID_LENGTH ||
      (payload.submittedAt !== null && typeof payload.submittedAt !== "string")
    ) {
      throw new InvalidLeaderReportCursorError();
    }

    if (payload.submittedAt === null) {
      return { sessionId: payload.sessionId, submittedAt: null };
    }

    const submittedAt = new Date(payload.submittedAt);
    if (
      Number.isNaN(submittedAt.getTime()) ||
      submittedAt.toISOString() !== payload.submittedAt
    ) {
      throw new InvalidLeaderReportCursorError();
    }

    return { sessionId: payload.sessionId, submittedAt };
  } catch (error) {
    if (error instanceof InvalidLeaderReportCursorError) throw error;
    throw new InvalidLeaderReportCursorError();
  }
}
