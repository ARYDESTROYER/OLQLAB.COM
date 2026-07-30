export type WorkspaceRole = "ADMIN" | "EMPLOYEE" | "LEADER";

export function hasParticipantWorkspaceAccess(role: WorkspaceRole) {
  return role === "EMPLOYEE" || role === "LEADER";
}

export function getFocusedSessionNavigation(pathname: string, role: WorkspaceRole) {
  const isPreview = pathname.startsWith("/assessment/session/preview_");

  return {
    exitHref: isPreview ? "/admin/assessments" : "/assessment/current",
    exitLabel: isPreview ? "Exit Preview" : "Exit Assessment",
    showMyReports: !isPreview && hasParticipantWorkspaceAccess(role),
  } as const;
}
