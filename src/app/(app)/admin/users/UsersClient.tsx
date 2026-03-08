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

export default function UsersClient() {
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<UsersMeta>({
    scope: "ALL",
    totalMatchingFilters: 0,
    totalAllAccounts: 0,
    totalParticipants: 0,
    totalAdmins: 0,
  });
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

  const [createForm, setCreateForm] = useState({
    tenantId: "",
    email: "",
    firstName: "",
    lastName: "",
    managerEmail: "",
  });

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
  }>({ open: false, title: "", message: "", onConfirm: () => { }, variant: "default", busy: false });

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
      if (options?.limit) params.set("limit", String(options.limit));
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

    if (addMode === "org" && !createForm.tenantId) {
      toast("Select an organization.", "error");
      return;
    }

    const payload: Record<string, unknown> = {
      email: createForm.email,
      firstName: createForm.firstName || undefined,
      lastName: createForm.lastName || undefined,
      role: "EMPLOYEE",
      managerEmail: createForm.managerEmail || undefined,
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
      toast(`User ${data.user?.email || createForm.email} added.`, "success");
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

  function requestDeleteUser(user: UserRow) {
    const displayName = `${user.firstName} ${user.lastName}`.trim() || "No name set";
    setConfirmState({
      open: true,
      title: "Delete User",
      message: `Are you sure you want to delete "${displayName}" (${user.email})? This action cannot be undone.`,
      variant: "danger",
      busy: false,
      onConfirm: () => executeDeleteUser(user.id),
    });
  }

  async function executeDeleteUser(userId: string) {
    setConfirmState((prev) => ({ ...prev, busy: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("User deleted.", "success");
        await loadUsers();
      } else {
        toast(data.error || "Failed to delete user.", "error");
      }
    } finally {
      setConfirmState((prev) => ({ ...prev, open: false, busy: false }));
    }
  }

  async function moveUser(userId: string) {
    const targetTenantId = moveTenantByUser[userId];
    if (!targetTenantId) {
      toast("Select a target organization first.", "error");
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

  async function makeUserSolo(user: UserRow) {
    if (user.tenant?.type === "SOLO") {
      toast("User is already solo.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Convert ${user.email} to a solo participant tenant? This will move them out of their current organization.`,
    );
    if (!confirmed) return;

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
          managerEmail: editForm.managerEmail.trim() || null,
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
      toast("Select a target organization for bulk move.", "error");
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

  async function bulkMakeSoloUsers() {
    const confirmed = window.confirm(
      `Convert ${selectedRows.length} selected users into solo participants?`,
    );
    if (!confirmed) return;

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

  async function bulkDeleteUsers() {
    const confirmed = window.confirm(
      `Delete ${selectedRows.length} selected users and all associated data? This cannot be undone.`,
    );
    if (!confirmed) return;

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

    return [
      { label: "Edit", onClick: () => startEditUser(user), disabled: isBusy || isAdmin },
      {
        label: "Make Solo",
        onClick: () => makeUserSolo(user),
        disabled: isBusy || isAdmin || user.tenant?.type === "SOLO",
      },
      { label: "View Tests", onClick: () => openInspect(user, "tests") },
      { label: "View Access", onClick: () => openInspect(user, "access") },
      {
        label: "Delete Everything",
        onClick: () => requestDeleteUser(user),
        variant: "danger",
        disabled: isBusy || isAdmin,
      },
    ];
  }

  return (
    <div className="space-y-6">
      {/* ── Add User ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add User</h2>

        {/* Mode toggle */}
        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${addMode === "org" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            onClick={() => setAddMode("org")}
          >
            Add to Organization
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
            ? "Add a user to an existing organization."
            : "Create an independent participant. They can be grouped into an organization later."}
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {addMode === "org" && (
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Organization</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={createForm.tenantId}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantId: e.target.value }))}
              >
                <option value="">Select organization</option>
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
                Archived organizations are shown but disabled. Unarchive them from Tenants first.
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
            Add
          </button>
        </div>

        {/* Optional fields toggle */}
        <button
          className="mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          onClick={() => setShowOptionalFields(!showOptionalFields)}
        >
          {showOptionalFields ? "▾ Hide optional fields" : "▸ More options (name, manager)"}
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
              placeholder="Manager email"
              value={createForm.managerEmail}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, managerEmail: e.target.value }))}
            />
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
              <option value="">All organizations</option>
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
                  <option value="ANY">All tenant types</option>
                  <option value="ORGANIZATION">Organization</option>
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
                  <option value="ANY">Tenant status: Any</option>
                  <option value="ACTIVE">Active tenants</option>
                  <option value="ARCHIVED">Archived tenants</option>
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
                <th className="px-3 py-2">Organization</th>
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
                      ? `Organization "${selectedOrganizationSummary.name}" exists, but no users match the current scope/filter.`
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
                            Open Organization
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
                              }))
                            }
                          >
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
        message={`${confirmState.message} This will permanently delete sessions, answers, scores, reports, enrollments, overrides, share links, auth sessions, and the user record.`}
        confirmLabel="Delete Everything"
        variant={confirmState.variant}
        busy={confirmState.busy}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
