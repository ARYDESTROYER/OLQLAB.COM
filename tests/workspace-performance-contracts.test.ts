import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("authenticated workspace performance contracts", () => {
  it("streams route feedback without forcing full authenticated prefetches", () => {
    const appLoading = read("../src/app/(app)/loading.tsx");
    const adminLoading = read("../src/app/(app)/admin/loading.tsx");
    const shell = read("../src/components/navigation/AppShell.tsx");
    const linkStatus = read("../src/components/navigation/WorkspaceLinkStatus.tsx");
    const routeWarmer = read(
      "../src/components/navigation/WorkspaceRouteWarmer.tsx",
    );
    const reportEditor = read(
      "../src/app/(app)/admin/reports/[reportId]/ReportEditorClient.tsx",
    );
    const responseReview = read(
      "../src/app/(app)/admin/assessments/[id]/participants/[userId]/responses/page.tsx",
    );
    const adminOverview = read("../src/app/(app)/admin/page.tsx");

    for (const loading of [appLoading, adminLoading]) {
      expect(loading).toContain('role="status"');
      expect(loading).toContain('aria-busy="true"');
      expect(loading).not.toContain("@/lib/auth");
      expect(loading).not.toContain("@/lib/db");
      expect(loading).not.toContain("<main");
    }

    expect(shell).not.toContain("<main");
    expect(shell).toContain("aria-current={active ? \"page\" : undefined}");
    expect(shell).toContain("aria-expanded={mobileOpen}");
    expect(shell).toContain("max-h-[calc(100svh-4.5rem)]");
    expect(shell).toContain('focused ? "hidden sm:block"');
    expect(shell).toContain('className="hidden sm:inline"');
    expect(shell).toContain("}, [pathname]);");
    expect(shell).not.toContain("prefetch={true}");
    expect(shell).toContain("<WorkspaceRouteWarmer role={role} />");
    const focusedBranch = shell.slice(
      shell.indexOf("if (focusedSession)"),
      shell.indexOf("\n  return (", shell.indexOf("if (focusedSession)")),
    );
    expect(focusedBranch).not.toContain("<WorkspaceRouteWarmer");
    expect(routeWarmer).toContain("requestIdleCallback");
    expect(routeWarmer).toContain("cancelIdleCallback");
    expect(routeWarmer).toContain("document.visibilityState");
    expect(routeWarmer).toContain("navigator.onLine");
    expect(routeWarmer).toContain('process.env.NODE_ENV !== "production"');
    expect(routeWarmer).toContain("shouldWarmWorkspaceRoutes(connection)");
    expect(routeWarmer).toContain(
      'connection?.addEventListener?.("change", resumeWhenConnectionAllows)',
    );
    expect(routeWarmer).toContain("takeNextWorkspaceWarmRoute(");
    expect(routeWarmer).toContain("window.location.pathname");
    expect(routeWarmer).toContain("router.prefetch(href)");
    expect(routeWarmer).not.toContain("PrefetchKind.FULL");
    expect(routeWarmer).not.toContain("onInvalidate");
    expect(routeWarmer).not.toContain("localStorage");
    expect(routeWarmer).not.toContain("caches.open");
    expect(routeWarmer).not.toContain("serviceWorker");
    expect(linkStatus).toContain("useLinkStatus");
    expect(linkStatus).toContain('role="status"');
    expect(reportEditor).not.toContain("<main");
    expect(responseReview).not.toContain("<main");
    expect(responseReview).toContain("const controller = new AbortController()");
    expect(responseReview).toContain("return () => controller.abort()");
    expect(adminOverview).toContain("const check = await getLiveAdminSession()");
    expect(adminOverview).toContain('if (!check) redirect("/dashboard")');
  });

  it("keeps marketing observers out of authenticated root hydration", () => {
    const root = read("../src/app/layout.tsx");
    const effects = read("../src/components/marketing/MarketingEffects.tsx");
    const chrome = read("../src/components/marketing/MarketingChrome.tsx");
    const directPages = [
      "../src/app/page.tsx",
      "../src/app/about/page.tsx",
      "../src/app/framework/page.tsx",
      "../src/app/blindspot/page.tsx",
      "../src/app/work/page.tsx",
      "../src/app/contact/page.tsx",
    ];

    expect(root).not.toContain("ScrollProgress");
    expect(root).not.toContain("ScrollReveal");
    expect(effects).toContain("<ScrollProgress />");
    expect(effects).toContain("<ScrollReveal />");
    expect(chrome).toContain("<MarketingEffects />");
    for (const path of directPages) {
      expect(read(path)).toContain("<MarketingEffects />");
    }
  });

  it("removes common participant query and navigation duplication", () => {
    const dashboard = read("../src/app/(app)/dashboard/page.tsx");
    const assessmentCenter = read("../src/app/(app)/assessment/current/page.tsx");
    const reports = read("../src/app/(app)/reports/current/page.tsx");
    const session = read("../src/app/(app)/assessment/session/[sessionId]/page.tsx");
    const assessmentStart = read(
      "../src/app/(app)/assessment/[assessmentId]/page.tsx",
    );

    expect(dashboard).not.toContain("db.user.findUnique");
    expect(dashboard).toContain("db.assessment");
    expect(dashboard).toContain(".count({");
    expect(assessmentCenter).toContain("getLiveSession");
    expect(assessmentCenter).not.toContain("db.user.findUnique");
    expect(assessmentCenter).toContain("_count:");
    expect(reports).toContain("resolveAssessmentAccessMany");
    expect(reports).not.toContain("reports.map(async");
    expect(session).not.toContain("router.refresh()");
    expect(session).toContain("const controller = new AbortController()");
    expect(session).toContain("return () => controller.abort()");
    expect(assessmentStart).toContain("const [access, assessment] = await Promise.all([");
    expect(assessmentStart).toContain("getLiveSession");
  });

  it("bounds admin fetch work and prevents stale search results", () => {
    const tenantApi = read("../src/app/api/admin/tenants/route.ts");
    const assessmentApi = read("../src/app/api/admin/assessments/route.ts");
    const userApi = read("../src/app/api/admin/users/route.ts");
    const users = read("../src/app/(app)/admin/users/UsersClient.tsx");
    const tenants = read("../src/app/(app)/admin/tenants/TenantsClient.tsx");
    const assessments = read("../src/app/(app)/admin/assessments/AssessmentsClient.tsx");
    const detail = read(
      "../src/app/(app)/admin/assessments/[id]/AssessmentDetailClient.tsx",
    );

    expect(tenantApi).toContain("usesDerivedWindow");
    expect(tenantApi).toContain(": take;");
    expect(assessmentApi).toContain("usesDerivedWindow");
    expect(assessmentApi).toContain(": take;");
    expect(userApi).toContain('params.get("includeContext") !== "0"');
    expect(userApi).toContain("const contextPromise = includeContext");
    for (const client of [users, tenants, assessments]) {
      expect(client).toContain("AbortController");
      expect(client).toContain("query.trim() ? 250 : 0");
      expect(client).toContain("aria-busy={listLoading}");
    }
    expect(detail).toContain('if (shouldLoadTab && tab === "CONTENT")');
    expect(detail).toContain('else if (shouldLoadTab && tab === "ACCESS")');
    expect(detail).toContain("loadedTabsRef.current.has(tab)");
    expect(detail).toContain("const shouldLoadDetail = forceTab || !hasLoadedRef.current");
    expect(detail).toContain("loadedTabsRef.current.delete(tab)");
    expect(detail).toContain('invalidateTabs("ACCESS", "PARTICIPANTS", "JOBS")');
    expect(detail).toContain("includeContext=0");
    expect(detail).toContain("enrollmentUsersRequestRef.current?.abort()");
    expect(detail).toContain("enrollmentUsersRequestRef.current !== controller");
    expect(detail).not.toContain(
      "setUserSearchQuery(formatUserOptionLabel(nextUser))",
    );
    expect(detail).toContain(
      "/api/admin/tenants?limit=500&sortBy=name&sortOrder=asc",
    );
    expect(detail).toContain("Assessment could not be opened");
    expect(detail).toContain('role="group"');
    expect(detail).toContain("aria-pressed={tab === item.key}");
    expect(detail).not.toContain('role="tablist"');
    expect(detail).toContain('showActiveTab && tab === "ACCESS"');
    expect(tenants).toContain("const urlQuery = searchParams.get");
    expect(tenants).toContain("}, [urlQuery]);");
  });
});
