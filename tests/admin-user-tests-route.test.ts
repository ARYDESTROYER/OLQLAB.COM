import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findArchives: vi.fn(),
  findSessions: vi.fn(),
  findUser: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/db", () => ({
  db: {
    quizSession: { findMany: mocks.findSessions },
    reportArchive: { findMany: mocks.findArchives },
    user: { findUnique: mocks.findUser },
  },
}));

import { GET } from "@/app/api/admin/users/[id]/tests/route";

describe("admin user test history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      session: { user: { id: "admin_1" } },
    });
    mocks.findUser.mockResolvedValue({
      id: "user_1",
      email: "participant@example.com",
      firstName: "Test",
      lastName: "Participant",
      role: "EMPLOYEE",
      tenant: { id: "tenant_1", name: "Example", type: "ORGANIZATION" },
    });
  });

  it("returns bounded live and archived history without archive payloads", async () => {
    mocks.findSessions.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        id: `session_${index}`,
        assessment: { id: "assessment_1", title: "Leadership" },
      })),
    );
    mocks.findArchives.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        id: `archive_${index}`,
        assessmentId: "assessment_1",
        submittedAt: new Date("2026-07-29T10:00:00.000Z"),
        archivedAt: new Date("2026-07-30T10:00:00.000Z"),
        archiveReason: "scheduled_retest_started",
        assessmentTitle: index === 0 ? "Archived title" : null,
        assessment: { id: "assessment_1", title: "Current title" },
      })),
    );

    const response = await GET(new Request("https://www.olqlab.com/api/admin/users/user_1/tests"), {
      params: Promise.resolve({ id: "user_1" }),
    });
    const body = (await response.json()) as {
      testsTaken: unknown[];
      testsTakenHasMore: boolean;
      reportArchives: Array<{ assessmentTitle: string }>;
      reportArchivesHasMore: boolean;
      historyLimit: number;
    };

    expect(response.status).toBe(200);
    expect(body.testsTaken).toHaveLength(100);
    expect(body.testsTakenHasMore).toBe(true);
    expect(body.reportArchives).toHaveLength(100);
    expect(body.reportArchivesHasMore).toBe(true);
    expect(body.historyLimit).toBe(100);
    expect(body.reportArchives[0]?.assessmentTitle).toBe("Archived title");
    expect(body.reportArchives[1]?.assessmentTitle).toBe("Current title");

    expect(mocks.findSessions).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
    expect(mocks.findArchives).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 101,
        select: {
          id: true,
          assessmentId: true,
          submittedAt: true,
          archivedAt: true,
          archiveReason: true,
          assessmentTitle: true,
          assessment: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    );
  });
});
