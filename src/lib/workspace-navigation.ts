export type WorkspaceRole = "ADMIN" | "EMPLOYEE" | "LEADER";

export type WorkspaceConnectionSnapshot = {
  effectiveType?: string;
  saveData?: boolean;
};

const PARTICIPANT_WARM_ROUTES = [
  "/dashboard",
  "/assessment/current",
  "/reports/current",
] as const;

const LEADER_WARM_ROUTES = [
  ...PARTICIPANT_WARM_ROUTES,
  "/reports/team",
] as const;

const ADMIN_WARM_ROUTES = [
  "/dashboard",
  "/admin",
] as const;

export function hasParticipantWorkspaceAccess(role: WorkspaceRole) {
  return role === "EMPLOYEE" || role === "LEADER";
}

export function getWorkspaceWarmRoutes(role: WorkspaceRole): readonly string[] {
  if (role === "ADMIN") return ADMIN_WARM_ROUTES;
  if (role === "LEADER") return LEADER_WARM_ROUTES;
  return PARTICIPANT_WARM_ROUTES;
}

export function shouldWarmWorkspaceRoutes(
  connection?: WorkspaceConnectionSnapshot | null,
) {
  if (connection?.saveData) return false;
  return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
}

export function takeNextWorkspaceWarmRoute(
  routes: readonly string[],
  startIndex: number,
  currentPathname: string,
): { href: string | null; nextIndex: number } {
  let nextIndex = startIndex;

  while (nextIndex < routes.length) {
    const href = routes[nextIndex];
    nextIndex += 1;
    if (href && href !== currentPathname) return { href, nextIndex };
  }

  return { href: null, nextIndex };
}

export function getFocusedSessionNavigation(pathname: string, role: WorkspaceRole) {
  const isPreview = pathname.startsWith("/assessment/session/preview_");

  return {
    exitHref: isPreview ? "/admin/assessments" : "/assessment/current",
    exitLabel: isPreview ? "Exit Preview" : "Exit Assessment",
    showMyReports: !isPreview && hasParticipantWorkspaceAccess(role),
  } as const;
}
