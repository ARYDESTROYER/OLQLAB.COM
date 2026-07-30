"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";
import InspectPanel, { TestsView, AccessView } from "@/components/admin/InspectPanel";

type OrganizationSummary = {
  organizationId: string;
  name: string;
  isArchived: boolean;
  totalUsers: number;
  participantUsers: number;
  adminUsers: number;
};

type UsersMeta = {
  scope: "ALL" | "PARTICIPANTS";
  totalMatchingFilters: number;
  totalCandidates: number;
  returned: number;
  limit: number;
  hasMore: boolean;
  truncated: boolean;
  totalAllAccounts: number;
  totalParticipants: number;
  totalAdmins: number;
};

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
  createdAt?: string;
  updatedAt?: string;
  tenant: {
    id: string;
    name: string;
    type?: "ORGANIZATION" | "SOLO";
    isArchived?: boolean;
  };
  manager?: { id: string; email: string; firstName: string; lastName: string } | null;
};

type BulkImportMode = "ORGANIZATION" | "SOLO";

type BulkImportSummary = {
  mode: BulkImportMode;
  requestedCount: number;
  readyCount: number;
  skippedCount: number;
  createdCount: number;
  repairedCount: number;
};

type BulkPreviewRow = {
  rowNumber: number;
  email: string;
  firstName: string;
  lastName: string;
  managerEmail: string;
  targetName: string;
  action: "CREATE_ORGANIZATION_USER" | "REPAIR_ORGANIZATION_USER" | "CREATE_SOLO_USER";
};

type BulkImportIssue = {
  rowNumber: number;
  email: string;
  reason: string;
  message: string;
};

function buildUserBulkCsvTemplate(mode: BulkImportMode) {
  const header = "email,first_name,last_name,manager_email,solo_organisation_name";
  const examples =
    mode === "SOLO"
      ? [
          "alex@example.com,Alex,Rivera,,Alex Solo Organisation",
          "jamie@example.com,Jamie,Chen,,",
        ]
      : [
          "alex@example.com,Alex,Rivera,manager@company.com,",
          "jamie@example.com,Jamie,Chen,,",
        ];

  return [header, ...examples].join("\n");
}

function formatBulkPreviewAction(action: BulkPreviewRow["action"]) {
  if (action === "CREATE_SOLO_USER") return "Create solo user";
  if (action === "REPAIR_ORGANIZATION_USER") return "Repair existing user";
  return "Create organisation user";
}

export default function UsersClient() {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<UsersMeta>({
    scope: "ALL",
    totalMatchingFilters: 0,
    totalCandidates: 0,
    returned: 0,
    limit: 100,
    hasMore: false,
    truncated: false,
    totalAllAccounts: 0,
    totalParticipants: 0,
    totalAdmins: 0,
  });
  const [listLimit, setListLimit] = useState(100);
  const [scope, setScope] = useState<"ALL" | "PARTICIPANTS">("ALL");
  const [query, setQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"" | "ADMIN" | "EMPLOYEE" | "LEADER">("");
  const [selectedTenantType, setSelectedTenantType] = useState<
    "ANY" | "ORGANIZATION" | "SOLO"
  >("ANY");
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<"ANY" | "WITH" | "WITHOUT">(
    "ANY",
  );
  const [selectedTenantArchived, setSelectedTenantArchived] = useState<
    "ANY" | "ACTIVE" | "ARCHIVED"
  >("ANY");
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "name" | "email">(
    "createdAt",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [busyUserId, setBusyUserId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkMoveTenantId, setBulkMoveTenantId] = useState("");

  // "solo" or "org" mode for the Add User form
  const [addMode, setAddMode] = useState<"org" | "solo">("org");
  const [createRole, setCreateRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");

  const [createForm, setCreateForm] = useState({
    tenantId: "",
    email: "",
    firstName: "",
    lastName: "",
    managerEmail: "",
  });
  const [bulkImportMode, setBulkImportMode] = useState<BulkImportMode>("ORGANIZATION");
  const [bulkImportTenantId, setBulkImportTenantId] = useState("");
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkImportBusy, setBulkImportBusy] = useState(false);
  const [bulkImportSummary, setBulkImportSummary] = useState<BulkImportSummary | null>(null);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [bulkImportIssues, setBulkImportIssues] = useState<BulkImportIssue[]>([]);

  const [moveTenantByUser, setMoveTenantByUser] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    role: "EMPLOYEE" as "ADMIN" | "EMPLOYEE" | "LEADER",
    managerEmail: "",
  });

  // Confirm dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "default";
    busy: boolean;
    confirmLabel: string;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => { },
    variant: "default",
    busy: false,
    confirmLabel: "Confirm",
  });

  function runConfirmed(action: () => Promise<void>) {
    setConfirmState((prev) => ({ ...prev, busy: true }));
    void action().finally(() => {
      setConfirmState((prev) => ({ ...prev, open: false, busy: false }));
    });
  }

  // Inspect panel
  const [inspectPanel, setInspectPanel] = useState<{
    open: boolean;
    title: string;
    type: "tests" | "access";
    data: Record<string, unknown> | null;
    loading: boolean;
  }>({ open: false, title: "", type: "tests", data: null, loading: false });

  const activeOrganizations = useMemo(
    () => organizations.filter((org) => !org.isArchived),
    [organizations],
  );
  const selectedOrganizationSummary = useMemo(
    () => organizations.find((organization) => organization.organizationId === selectedTenantId) || null,
    [organizations, selectedTenantId],
  );
  const selectedRows = useMemo(
    () => users.filter((user) => selectedUserIds.includes(user.id)),
    [users, selectedUserIds],
  );
  const selectableRows = useMemo(
    () => users.filter((user) => user.role !== "ADMIN"),
    [users],
  );
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedUserIds.includes(row.id));

  const buildUsersQueryParams = useCallback(
    (options?: { format?: "csv"; limit?: number }) => {
      const params = new URLSearchParams();
      params.set("scope", scope);
      if (query.trim()) params.set("q", query.trim());
      if (selectedTenantId) params.set("tenantId", selectedTenantId);
      if (selectedRole) params.set("role", selectedRole);
      if (selectedTenantType !== "ANY") params.set("tenantType", selectedTenantType);
      if (selectedManagerFilter === "WITH") params.set("hasManager", "1");
      if (selectedManagerFilter === "WITHOUT") params.set("hasManager", "0");
      if (selectedTenantArchived === "ACTIVE") params.set("tenantArchived", "0");
      if (selectedTenantArchived === "ARCHIVED") params.set("tenantArchived", "1");
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", String(options?.limit ?? listLimit));
      if (options?.format) params.set("format", options.format);
      return params;
    },
    [
      scope,
      query,
      selectedTenantArchived,
      selectedTenantId,
      selectedTenantType,
      selectedRole,
      selectedManagerFilter,
      sortBy,
      sortOrder,
      listLimit,
    ],
  );

  const loadUsers = useCallback(async () => {
    const params = buildUsersQueryParams();
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await res.json();
    const rows = (data.users || []) as UserRow[];
    const nextOrganizations = (data.organizations || []) as OrganizationSummary[];
    setUsers(rows);
    setOrganizations(nextOrganizations);
    setMeta(
      (data.meta as UsersMeta | undefined) || {
        scope: "ALL",
        totalMatchingFilters: rows.length,
        totalCandidates: rows.length,
        returned: rows.length,
        limit: 100,
        hasMore: false,
        truncated: false,
        totalAllAccounts: rows.length,
        totalParticipants: rows.filter((row) => row.role !== "ADMIN").length,
        totalAdmins: rows.filter((row) => row.role === "ADMIN").length,
      },
    );
    setScope(((data.meta as UsersMeta | undefined)?.scope || "ALL") as "ALL" | "PARTICIPANTS");
    setSelectedUserIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    setCreateForm((prev) => {
      const tenantStillValid = nextOrganizations.some(
        (organization) => organization.organizationId === prev.tenantId && !organization.isArchived,
      );
      if (tenantStillValid) return prev;

      const firstActive = nextOrganizations.find((organization) => !organization.isArchived);
      return { ...prev, tenantId: firstActive?.organizationId || "" };
    });
    setBulkImportTenantId((prev) => {
      const tenantStillValid = nextOrganizations.some(
        (organization) => organization.organizationId === prev && !organization.isArchived,
      );
      if (tenantStillValid) return prev;

      const firstActive = nextOrganizations.find((organization) => !organization.isArchived);
      return firstActive?.organizationId || "";
    });
  }, [buildUsersQueryParams]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (scope === "PARTICIPANTS" && selectedRole === "ADMIN") {
      setSelectedRole("");
    }
  }, [scope, selectedRole]);

  // ----- Actions -----

  async function createUser() {
    if (!createForm.email.trim()) {
      toast("Email is required.", "error");
      return;
    }

    if (addMode === "solo" && createRole === "ADMIN") {
      toast("Admin accounts must belong to an organisation.", "error");
      return;
    }

    if (addMode === "org" && !createForm.tenantId) {
      toast("Select an organisation.", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      email: createForm.email,
      firstName: createForm.firstName || undefined,
      lastName: createForm.lastName || undefined,
      role: createRole,
      managerEmail: createRole === "ADMIN" ? undefined : createForm.managerEmail || undefined,
    };

    if (addMode === "solo") {
      payload.createSoloTenant = true;
    } else {
      payload.tenantId = createForm.tenantId;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      toast(
        `${createRole === "ADMIN" ? "Admin" : "User"} ${data.user?.email || createForm.email} saved.`,
        "success",
      );
      setCreateForm((prev) => ({
        ...prev,
        email: "",
        firstName: "",
        lastName: "",
        managerEmail: "",
      }));
      setShowOptionalFields(false);
      await loadUsers();
    } else {
      toast(data.error || "Failed to create user.", "error");
    }
  }

  function clearBulkImportResults() {
    setBulkImportSummary(null);
    setBulkPreviewRows([]);
    setBulkImportIssues([]);
  }

  function resetBulkImport(clearCsv: boolean) {
    clearBulkImportResults();
    if (clearCsv) {
      setBulkCsvText("");
      setBulkCsvFileName("");
    }
  }

  function downloadBulkCsvTemplate() {
    const blob = new Blob([buildUserBulkCsvTemplate(bulkImportMode)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      bulkImportMode === "SOLO"
        ? "solo-user-import-template.csv"
        : "organisation-user-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleBulkCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setBulkCsvText(text);
      setBulkCsvFileName(file.name);
      clearBulkImportResults();
      toast(`Loaded ${file.name}.`, "success");
    } catch {
      toast("Failed to read CSV file.", "error");
    } finally {
      e.target.value = "";
    }
  }

  async function runBulkImportRequest(dryRun: boolean) {
    if (bulkImportMode === "ORGANIZATION" && !bulkImportTenantId) {
      toast("Select an organisation for bulk import.", "error");
      return;
    }
    if (!bulkCsvText.trim()) {
      toast("Paste CSV content or load a CSV file first.", "error");
      return;
    }

    setBulkImportBusy(true);
    try {
      const res = await fetch(`/api/admin/users/import-csv${dryRun ? "?dryRun=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: bulkImportMode,
          tenantId: bulkImportMode === "ORGANIZATION" ? bulkImportTenantId : undefined,
          csvText: bulkCsvText,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        summary?: BulkImportSummary;
        previewRows?: BulkPreviewRow[];
        issues?: BulkImportIssue[];
      };

      setBulkImportSummary(data.summary || null);
      setBulkPreviewRows(data.previewRows || []);
      setBulkImportIssues(data.issues || []);

      if (!res.ok) {
        toast(data.error || "Bulk import failed.", "error");
        return;
      }

      if (dryRun) {
        toast("CSV validated. Review the preview, then import.", "success");
        return;
      }

      const createdCount = data.summary?.createdCount || 0;
      const repairedCount = data.summary?.repairedCount || 0;
      toast(
        `Bulk import complete: ${createdCount} created, ${repairedCount} repaired, ${data.summary?.skippedCount || 0} skipped.`,
        "success",
      );
      resetBulkImport(true);
      await loadUsers();
    } finally {
      setBulkImportBusy(false);
    }
  }

  function requestDeleteUser(user: UserRow) {
    const displayName = `${user.firstName} ${user.lastName}`.trim() || "No name set";
    setConfirmState({
      open: true,
      title: "Delete User",
      message: `Are you sure you want to delete "${displayName}" (${user.email})? This permanently deletes sessions, answers, scores, reports, enrollments, overrides, share links, auth sessions, and the user record. This cannot be undone.`,
      variant: "danger",
      busy: false,
      confirmLabel: "Delete Everything",
      onConfirm: () => runConfirmed(() => executeDeleteUser(user.id)),
    });
  }

  async function executeDeleteUser(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast("User deleted.", "success");
      await loadUsers();
    } else {
      toast(data.error || "Failed to delete user.", "error");
    }
  }

  async function moveUser(userId: string) {
    const targetTenantId = moveTenantByUser[userId];
    if (!targetTenantId) {
      toast("Select a target organisation first.", "error");
      return;
    }

    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: targetTenantId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("User moved.", "success");
        await loadUsers();
      } else {
        toast(data.error || "Failed to move user.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  function makeUserSolo(user: UserRow) {
    if (user.tenant?.type === "SOLO") {
      toast("User is already solo.", "error");
      return;
    }

    setConfirmState({
      open: true,
      title: "Convert to Solo Participant",
      message: `Convert ${user.email} to a solo participant Organisation? This moves them out of their current Organisation and clears cross-Organisation manager links.`,
      variant: "default",
      busy: false,
      confirmLabel: "Convert to Solo",
      onConfirm: () => runConfirmed(() => executeMakeUserSolo(user)),
    });
  }

  async function executeMakeUserSolo(user: UserRow) {
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convertToSolo: true,
          soloTenantName: `Solo - ${user.email}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("User converted to solo.", "success");
        await loadUsers();
      } else {
        toast(data.error || "Failed to convert user to solo.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  function startEditUser(user: UserRow) {
    setEditingUserId(user.id);
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      managerEmail: user.manager?.email || "",
    });
  }

  function cancelEditUser() {
    setEditingUserId("");
    setEditForm({
      firstName: "",
      lastName: "",
      role: "EMPLOYEE",
      managerEmail: "",
    });
  }

  async function saveEditUser(userId: string) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          role: editForm.role,
          managerEmail: editForm.role === "ADMIN" ? null : editForm.managerEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("User updated.", "success");
        cancelEditUser();
        await loadUsers();
      } else {
        toast(data.error || "Failed to update user.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  function promoteUserToAdmin(user: UserRow) {
    if (user.role === "ADMIN") return;

    setConfirmState({
      open: true,
      title: "Promote to Admin",
      message: `Promote ${user.email} to admin? They will gain global admin access.`,
      variant: "default",
      busy: false,
      confirmLabel: "Promote to Admin",
      onConfirm: () => runConfirmed(() => executePromoteUserToAdmin(user)),
    });
  }

  async function executePromoteUserToAdmin(user: UserRow) {
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "ADMIN",
          managerEmail: null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("User promoted to admin.", "success");
        await loadUsers();
      } else {
        toast(data.error || "Failed to promote user.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  async function openInspect(user: UserRow, type: "tests" | "access") {
    const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;
    setInspectPanel({
      open: true,
      title: `${displayName} — ${type === "tests" ? "Tests" : "Access"}`,
      type,
      data: null,
      loading: true,
    });

    try {
      const res = await fetch(`/api/admin/users/${user.id}/${type}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(
          (data as { error?: string } | null)?.error || "Failed to load data.",
          "error",
        );
        setInspectPanel((prev) => ({ ...prev, data: null, loading: false }));
        return;
      }
      setInspectPanel((prev) => ({ ...prev, data, loading: false }));
    } catch {
      toast("Failed to load data.", "error");
      setInspectPanel((prev) => ({ ...prev, data: null, loading: false }));
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") loadUsers();
  }

  function clearAdvancedFilters() {
    setScope("ALL");
    setSelectedRole("");
    setSelectedTenantType("ANY");
    setSelectedManagerFilter("ANY");
    setSelectedTenantArchived("ANY");
    setSortBy("createdAt");
    setSortOrder("desc");
    setSelectedTenantId("");
    setQuery("");
    setListLimit(100);
  }

  function toggleAllSelectable(checked: boolean) {
    if (!checked) {
      setSelectedUserIds([]);
      return;
    }
    setSelectedUserIds(selectableRows.map((row) => row.id));
  }

  function toggleUserSelection(userId: string, checked: boolean) {
    setSelectedUserIds((prev) => {
      if (checked) return Array.from(new Set([...prev, userId]));
      return prev.filter((id) => id !== userId);
    });
  }

  async function exportUsersCsv() {
    try {
      const params = buildUsersQueryParams({ format: "csv", limit: 5000 });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || "Failed to export CSV.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("CSV export started.", "success");
    } catch {
      toast("Failed to export CSV.", "error");
    }
  }

  async function runBulkAction(
    label: string,
    worker: (user: UserRow) => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (selectedRows.length === 0) {
      toast("Select at least one user.", "error");
      return;
    }

    setBulkBusy(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const user of selectedRows) {
      const result = await worker(user);
      if (result.ok) {
        successCount += 1;
      } else {
        failCount += 1;
        if (result.error && errors.length < 3) {
          errors.push(result.error);
        }
      }
    }

    setBulkBusy(false);
    setSelectedUserIds([]);
    setBulkMoveTenantId("");
    await loadUsers();

    if (failCount === 0) {
      toast(`${label} complete: ${successCount} updated.`, "success");
      return;
    }

    const suffix = errors.length ? ` First error: ${errors[0]}` : "";
    toast(`${label} complete: ${successCount} updated, ${failCount} failed.${suffix}`, "error");
  }

  async function bulkMoveUsers() {
    if (!bulkMoveTenantId) {
      toast("Select a target organisation for bulk move.", "error");
      return;
    }
    await runBulkAction("Bulk move", async (user) => {
      if (user.role === "ADMIN") {
        return { ok: false, error: `${user.email}: admin users cannot be moved.` };
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: bulkMoveTenantId }),
      });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: `${user.email}: ${data.error || "Move failed."}` };
    });
  }

  function bulkMakeSoloUsers() {
    if (selectedRows.length === 0) {
      toast("Select at least one user.", "error");
      return;
    }
    setConfirmState({
      open: true,
      title: "Convert Selected Users",
      message: `Convert ${selectedRows.length} selected users into solo participants? Each user will move into a separate Solo Organisation.`,
      variant: "default",
      busy: false,
      confirmLabel: "Convert Selected",
      onConfirm: () => runConfirmed(executeBulkMakeSoloUsers),
    });
  }

  async function executeBulkMakeSoloUsers() {
    await runBulkAction("Bulk solo conversion", async (user) => {
      if (user.role === "ADMIN") {
        return { ok: false, error: `${user.email}: admin users cannot be converted.` };
      }
      if (user.tenant?.type === "SOLO") {
        return { ok: true };
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convertToSolo: true,
          soloTenantName: `Solo - ${user.email}`,
        }),
      });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: `${user.email}: ${data.error || "Conversion failed."}` };
    });
  }

  function bulkDeleteUsers() {
    if (selectedRows.length === 0) {
      toast("Select at least one user.", "error");
      return;
    }
    setConfirmState({
      open: true,
      title: "Delete Selected Users",
      message: `Delete ${selectedRows.length} selected users and all associated sessions, answers, reports, enrollment, and authentication data? This cannot be undone.`,
      variant: "danger",
      busy: false,
      confirmLabel: "Delete Selected",
      onConfirm: () => runConfirmed(executeBulkDeleteUsers),
    });
  }

  async function executeBulkDeleteUsers() {
    await runBulkAction("Bulk delete", async (user) => {
      if (user.role === "ADMIN") {
        return { ok: false, error: `${user.email}: admin users cannot be deleted.` };
      }

      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: `${user.email}: ${data.error || "Delete failed."}` };
    });
  }

  // ----- Row actions (enrollment removed — lives in Assessment > Access) -----

  function getRowActions(user: UserRow): ActionItem[] {
    const isAdmin = user.role === "ADMIN";
    const isBusy = busyUserId === user.id;

    const actions: ActionItem[] = [
      { label: "Edit", onClick: () => startEditUser(user), disabled: isBusy },
      { label: "View Tests", onClick: () => openInspect(user, "tests") },
      { label: "View Access", onClick: () => openInspect(user, "access") },
    ];

    if (!isAdmin) {
      actions.splice(1, 0, {
        label: "Promote to Admin",
        onClick: () => promoteUserToAdmin(user),
        disabled: isBusy,
      });
      actions.push({
        label: "Make Solo",
        onClick: () => makeUserSolo(user),
        disabled: isBusy || user.tenant?.type === "SOLO",
      });
      actions.push({
        label: "Delete Everything",
        onClick: () => requestDeleteUser(user),
        variant: "danger",
        disabled: isBusy,
      });
    }

    return actions;
  }

  return (
    <div className="space-y-6">
      {/* ── Add User ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add Account</h2>

        {/* Mode toggle */}
        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${addMode === "org" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            onClick={() => setAddMode("org")}
          >
            Add to Organisation
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${addMode === "solo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            onClick={() => setAddMode("solo")}
          >
            Add Solo Participant
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {addMode === "org"
            ? createRole === "ADMIN"
              ? "Create an admin account inside an existing organisation."
              : "Add a participant to an existing organisation."
            : "Create an independent participant. They can be grouped into an organisation later."}
        </p>

        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${createRole === "EMPLOYEE" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            onClick={() => setCreateRole("EMPLOYEE")}
          >
            Participant
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${createRole === "ADMIN" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            onClick={() => {
              setCreateRole("ADMIN");
              if (addMode === "solo") setAddMode("org");
            }}
          >
            Admin
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {addMode === "org" && (
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Organisation</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={createForm.tenantId}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantId: e.target.value }))}
              >
                <option value="">Select organisation</option>
                {organizations.map((organization) => (
                  <option
                    key={organization.organizationId}
                    value={organization.organizationId}
                    disabled={organization.isArchived}
                  >
                    {organization.name}
                    {organization.isArchived ? " (Archived)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Archived organisations are shown but disabled. Unarchive them from Organisations first.
              </p>
            </div>
          )}

          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Email</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="participant@company.com"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <button
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            onClick={createUser}
          >
            {createRole === "ADMIN" ? "Add Admin" : "Add"}
          </button>
        </div>

        {/* Optional fields toggle */}
        <button
          className="mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          onClick={() => setShowOptionalFields(!showOptionalFields)}
        >
          {showOptionalFields
            ? "▾ Hide optional fields"
            : `▸ More options (name${createRole === "ADMIN" ? "" : ", manager"})`}
        </button>

        {showOptionalFields && (
          <div className="mt-2 grid gap-2 md:grid-cols-3 animate-slide-in-menu">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="First name"
              value={createForm.firstName}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Last name"
              value={createForm.lastName}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={createRole === "ADMIN" ? "Manager email not used for admins" : "Manager email"}
              value={createForm.managerEmail}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, managerEmail: e.target.value }))}
              disabled={createRole === "ADMIN"}
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Bulk Add Users</h2>

        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              bulkImportMode === "ORGANIZATION"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => {
              setBulkImportMode("ORGANIZATION");
              clearBulkImportResults();
            }}
          >
            Bulk Add to Organisation
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              bulkImportMode === "SOLO"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => {
              setBulkImportMode("SOLO");
              clearBulkImportResults();
            }}
          >
            Bulk Add Solo Participants
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          {bulkImportMode === "ORGANIZATION"
            ? "Import multiple participants into one existing organisation."
            : "Create one solo organisation per CSV row. Use the optional solo_organisation_name column to override the default name."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {bulkImportMode === "ORGANIZATION" && (
            <select
              className="min-w-[240px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={bulkImportTenantId}
              onChange={(e) => {
                setBulkImportTenantId(e.target.value);
                clearBulkImportResults();
              }}
            >
              <option value="">Select organisation</option>
              {activeOrganizations.map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.name}
                </option>
              ))}
            </select>
          )}
          <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors">
            Load CSV File
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={handleBulkCsvFileChange}
            />
          </label>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={downloadBulkCsvTemplate}
          >
            Download Template
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            onClick={() => runBulkImportRequest(true)}
            disabled={bulkImportBusy}
          >
            {bulkImportBusy ? "Working..." : "Validate CSV"}
          </button>
          <button
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            onClick={() => runBulkImportRequest(false)}
            disabled={bulkImportBusy}
          >
            Import Users
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              CSV columns: email, first_name, last_name, manager_email, solo_organisation_name
            </span>
            {bulkCsvFileName ? <span>Loaded file: {bulkCsvFileName}</span> : null}
          </div>
          <textarea
            className="min-h-[180px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Paste CSV content here..."
            value={bulkCsvText}
            onChange={(e) => {
              setBulkCsvText(e.target.value);
              clearBulkImportResults();
            }}
          />
        </div>

        {bulkImportSummary && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span>Rows: {bulkImportSummary.requestedCount}</span>
              <span>Ready: {bulkImportSummary.readyCount}</span>
              <span>Skipped: {bulkImportSummary.skippedCount}</span>
              <span>Created: {bulkImportSummary.createdCount}</span>
              <span>Repaired: {bulkImportSummary.repairedCount}</span>
            </div>
          </div>
        )}

        {(bulkPreviewRows.length > 0 || bulkImportIssues.length > 0) && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                Preview
              </div>
              {bulkPreviewRows.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-500">No importable rows in current CSV.</div>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreviewRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.email}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-700">{row.email}</div>
                            <div className="text-[11px] text-slate-500">
                              {[row.firstName, row.lastName].filter(Boolean).join(" ") || "No name set"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{formatBulkPreviewAction(row.action)}</td>
                          <td className="px-3 py-2 text-slate-600">{row.targetName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                Issues
              </div>
              {bulkImportIssues.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-500">No issues found in the current preview.</div>
              ) : (
                <div className="max-h-80 overflow-auto px-3 py-2">
                  <div className="space-y-2">
                    {bulkImportIssues.map((issue) => (
                      <div key={`${issue.rowNumber}-${issue.email}-${issue.reason}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                        <div className="text-xs font-semibold text-rose-700">
                          Row {issue.rowNumber}
                          {issue.email ? ` · ${issue.email}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-rose-700">{issue.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── User Directory ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-300 bg-white p-1 text-xs">
              <button
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${scope === "ALL" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => setScope("ALL")}
              >
                All Accounts
              </button>
              <button
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${scope === "PARTICIPANTS" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => setScope("PARTICIPANTS")}
              >
                Participants
              </button>
            </div>
            <input
              className="w-full min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search users..."
            />
            <select
              className="min-w-[190px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              <option value="">All organisations</option>
              {organizations.map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.name}
                  {organization.isArchived ? " (Archived)" : ""}
                  {` · P:${organization.participantUsers} A:${organization.adminUsers}`}
                </option>
              ))}
            </select>
            <select
              className="min-w-[150px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole(e.target.value as "" | "ADMIN" | "EMPLOYEE" | "LEADER")
              }
            >
              <option value="">All roles</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="LEADER">LEADER</option>
              <option value="ADMIN" disabled={scope === "PARTICIPANTS"}>
                ADMIN
              </option>
            </select>
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
            >
              {showAdvancedFilters ? "Hide Filters" : "More Filters"}
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
              onClick={loadUsers}
            >
              Refresh
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              onClick={exportUsersCsv}
            >
              Export CSV
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Showing {users.length} of {meta.totalMatchingFilters} user(s) (scope:{" "}
            {meta.scope === "PARTICIPANTS" ? "Participants only" : "All accounts"}). Platform totals:
            {" "}
            {meta.totalAllAccounts} accounts, {meta.totalParticipants} participants, {meta.totalAdmins} admins.
          </p>
          {meta.hasMore ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>
                This list is limited to {meta.limit} rows. CSV export will refuse an incomplete file.
              </p>
              {meta.limit < 500 ? (
                <button
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-100"
                  onClick={() => setListLimit((current) => Math.min(500, current + 100))}
                >
                  Load 100 more
                </button>
              ) : (
                <span className="font-medium">
                  Narrow the filters to inspect all {meta.totalCandidates} matching users.
                </span>
              )}
            </div>
          ) : null}

          {showAdvancedFilters && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[170px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={selectedTenantType}
                  onChange={(e) =>
                    setSelectedTenantType(e.target.value as "ANY" | "ORGANIZATION" | "SOLO")
                  }
                >
                  <option value="ANY">All organisation types</option>
                  <option value="ORGANIZATION">Organisation</option>
                  <option value="SOLO">Solo</option>
                </select>
                <select
                  className="min-w-[170px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={selectedManagerFilter}
                  onChange={(e) =>
                    setSelectedManagerFilter(e.target.value as "ANY" | "WITH" | "WITHOUT")
                  }
                >
                  <option value="ANY">Manager: Any</option>
                  <option value="WITH">With manager</option>
                  <option value="WITHOUT">Without manager</option>
                </select>
                <select
                  className="min-w-[170px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={selectedTenantArchived}
                  onChange={(e) =>
                    setSelectedTenantArchived(e.target.value as "ANY" | "ACTIVE" | "ARCHIVED")
                  }
                >
                  <option value="ANY">Organisation status: Any</option>
                  <option value="ACTIVE">Active organisations</option>
                  <option value="ARCHIVED">Archived organisations</option>
                </select>
                <select
                  className="min-w-[150px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "createdAt" | "updatedAt" | "name" | "email")
                  }
                >
                  <option value="createdAt">Sort: Created</option>
                  <option value="updatedAt">Sort: Updated</option>
                  <option value="name">Sort: Name</option>
                  <option value="email">Sort: Email</option>
                </select>
                <select
                  className="min-w-[140px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
                  onClick={clearAdvancedFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedUserIds.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {selectedUserIds.length} selected
              </span>
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                value={bulkMoveTenantId}
                onChange={(e) => setBulkMoveTenantId(e.target.value)}
                disabled={bulkBusy}
              >
                <option value="">Move selected to...</option>
                {activeOrganizations.map((organization) => (
                  <option key={organization.organizationId} value={organization.organizationId}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors disabled:opacity-50"
                onClick={bulkMoveUsers}
                disabled={bulkBusy || !bulkMoveTenantId}
              >
                {bulkBusy ? "Working..." : "Move Selected"}
              </button>
              <button
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                onClick={bulkMakeSoloUsers}
                disabled={bulkBusy}
              >
                Make Solo
              </button>
              <button
                className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] hover:bg-rose-100 transition-colors disabled:opacity-50"
                onClick={bulkDeleteUsers}
                disabled={bulkBusy}
              >
                Delete Selected
              </button>
              <button
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                onClick={() => setSelectedUserIds([])}
                disabled={bulkBusy}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto overflow-y-visible rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={(e) => toggleAllSelectable(e.target.checked)}
                    aria-label="Select all non-admin users"
                  />
                </th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <EmptyState
                  icon="👤"
                  title="No users found"
                  description={
                    selectedTenantId && selectedOrganizationSummary
                      ? `Organisation "${selectedOrganizationSummary.name}" exists, but no users match the current scope/filter.`
                      : "Try adjusting your search or add a user above."
                  }
                  colSpan={5}
                />
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={(e) => toggleUserSelection(user.id, e.target.checked)}
                        disabled={user.role === "ADMIN" || bulkBusy}
                        aria-label={`Select ${user.email}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{`${user.firstName} ${user.lastName}`.trim() || "No name set"}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      {user.role === "ADMIN" && (
                        <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Admin</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {user.tenant?.name}
                      {user.tenant?.type === "SOLO" && (
                        <span className="ml-1.5 text-[10px] text-slate-400">(Solo)</span>
                      )}
                      {user.tenant?.isArchived && (
                        <span className="ml-1.5 text-[10px] text-amber-600">(Archived)</span>
                      )}
                      {user.tenant?.type === "ORGANIZATION" && (
                        <div className="mt-1">
                          <Link
                            href={`/admin/tenants?q=${encodeURIComponent(user.tenant?.name || "")}`}
                            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                          >
                            Open Organisation
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{user.manager?.email || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <ActionMenu actions={getRowActions(user)} />

                        <select
                          className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          value={moveTenantByUser[user.id] || ""}
                          onChange={(e) =>
                            setMoveTenantByUser((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                        >
                          <option value="">Move to…</option>
                          {activeOrganizations.map((organization) => (
                            <option
                              key={organization.organizationId}
                              value={organization.organizationId}
                            >
                              {organization.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                          onClick={() => moveUser(user.id)}
                          disabled={busyUserId === user.id || user.role === "ADMIN" || bulkBusy}
                        >
                          Move
                        </button>
                      </div>

                      {editingUserId === user.id && (
                        <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-5">
                          <input
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            placeholder="First name"
                            value={editForm.firstName}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                          />
                          <input
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            placeholder="Last name"
                            value={editForm.lastName}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                          />
                          <input
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            placeholder="Manager email"
                            value={editForm.managerEmail}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, managerEmail: e.target.value }))}
                          />
                          <select
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            value={editForm.role}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                role: e.target.value as "ADMIN" | "EMPLOYEE" | "LEADER",
                                managerEmail:
                                  e.target.value === "ADMIN" ? "" : prev.managerEmail,
                              }))
                            }
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="EMPLOYEE">EMPLOYEE</option>
                            <option value="LEADER">LEADER</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white"
                              onClick={() => saveEditUser(user.id)}
                              disabled={busyUserId === user.id}
                            >
                              Save
                            </button>
                            <button
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px]"
                              onClick={cancelEditUser}
                              disabled={busyUserId === user.id}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Inspect Panel ── */}
      <InspectPanel
        open={inspectPanel.open}
        title={inspectPanel.title}
        onClose={() => setInspectPanel((prev) => ({ ...prev, open: false }))}
      >
        {inspectPanel.loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">Loading…</div>
          </div>
        ) : inspectPanel.data ? (
          inspectPanel.type === "tests" ? (
            <TestsView
              sessions={(inspectPanel.data.testsTaken || []) as never[]}
              archives={(inspectPanel.data.reportArchives || []) as never[]}
              sessionsHasMore={inspectPanel.data.testsTakenHasMore === true}
              archivesHasMore={inspectPanel.data.reportArchivesHasMore === true}
              historyLimit={
                typeof inspectPanel.data.historyLimit === "number"
                  ? inspectPanel.data.historyLimit
                  : undefined
              }
            />
          ) : (
            <AccessView access={(inspectPanel.data.access || []) as never[]} />
          )
        ) : null}
      </InspectPanel>

      {/* ── Confirm Dialog ── */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        busy={confirmState.busy}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
