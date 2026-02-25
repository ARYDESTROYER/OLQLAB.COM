"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";
import InspectPanel, { TestsView, AccessView } from "@/components/admin/InspectPanel";

type Tenant = {
  id: string;
  name: string;
  type: "ORGANIZATION" | "SOLO";
  seatLimit: number;
  isArchived: boolean;
};

type Assessment = {
  id: string;
  title: string;
  isPublished: boolean;
};

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
  tenant: { id: string; name: string; type?: "ORGANIZATION" | "SOLO" };
  manager?: { id: string; email: string; firstName: string; lastName: string } | null;
};

export default function UsersClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assessmentIdInput, setAssessmentIdInput] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const [createForm, setCreateForm] = useState({
    tenantId: "",
    email: "",
    firstName: "",
    lastName: "",
    managerEmail: "",
  });

  const [moveTenantByUser, setMoveTenantByUser] = useState<Record<string, string>>({});

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "default";
    busy: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => { }, variant: "default", busy: false });

  // Inspect panel state
  const [inspectPanel, setInspectPanel] = useState<{
    open: boolean;
    title: string;
    type: "tests" | "access";
    data: Record<string, unknown> | null;
    loading: boolean;
  }>({ open: false, title: "", type: "tests", data: null, loading: false });

  // Only show ORGANIZATION tenants (hide SOLO)
  const orgTenants = useMemo(
    () => tenants.filter((t) => t.type === "ORGANIZATION" && !t.isArchived),
    [tenants],
  );

  // ----- Data loaders -----

  const loadTenants = useCallback(async () => {
    const res = await fetch("/api/admin/tenants?includeArchived=1");
    const data = await res.json();
    setTenants(data.tenants || []);
    setCreateForm((prev) => {
      if (prev.tenantId) return prev;
      const firstOrg = (data.tenants || []).find(
        (t: Tenant) => t.type === "ORGANIZATION" && !t.isArchived,
      );
      if (firstOrg) return { ...prev, tenantId: firstOrg.id };
      return prev;
    });
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedTenantId) params.set("tenantId", selectedTenantId);

    const res = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await res.json();
    setUsers(data.users || []);
  }, [query, selectedTenantId]);

  const loadAssessments = useCallback(async () => {
    const res = await fetch("/api/admin/assessments");
    const data = await res.json();
    setAssessments(data.assessments || []);
  }, []);

  useEffect(() => {
    loadTenants();
    loadAssessments();
  }, [loadTenants, loadAssessments]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ----- Actions -----

  async function createUser() {
    if (!createForm.tenantId || !createForm.email.trim()) {
      toast("Organization and email are required.", "error");
      return;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: createForm.tenantId,
        email: createForm.email,
        firstName: createForm.firstName || undefined,
        lastName: createForm.lastName || undefined,
        role: "EMPLOYEE",
        managerEmail: createForm.managerEmail || undefined,
      }),
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
    setConfirmState({
      open: true,
      title: "Delete User",
      message: `Are you sure you want to delete "${user.firstName} ${user.lastName}" (${user.email})? This action cannot be undone.`,
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

  async function openInspect(user: UserRow, type: "tests" | "access") {
    setInspectPanel({
      open: true,
      title: `${user.firstName} ${user.lastName} — ${type === "tests" ? "Tests" : "Access"}`,
      type,
      data: null,
      loading: true,
    });

    try {
      const res = await fetch(`/api/admin/users/${user.id}/${type}`);
      const data = await res.json();
      setInspectPanel((prev) => ({ ...prev, data, loading: false }));
    } catch {
      toast("Failed to load data.", "error");
      setInspectPanel((prev) => ({ ...prev, loading: false }));
    }
  }

  async function enrollmentAction(userId: string, action: "ENROLL" | "UNENROLL") {
    if (!assessmentIdInput) {
      toast("Please select an assessment first.", "error");
      return;
    }

    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessmentIdInput,
          action,
          reportMode: "KEEP_APP_ACCESS",
          notifyByEmail: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`User ${action === "ENROLL" ? "enrolled" : "unenrolled"} successfully.`, "success");
        await loadUsers();
      } else {
        toast(data.error || `Failed to ${action.toLowerCase()} user.`, "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") loadUsers();
  }

  // ----- Row actions -----

  function getRowActions(user: UserRow): ActionItem[] {
    const isAdmin = user.role === "ADMIN";
    const isBusy = busyUserId === user.id;

    return [
      { label: "View Tests", onClick: () => openInspect(user, "tests") },
      { label: "View Access", onClick: () => openInspect(user, "access") },
      { label: "Enroll", onClick: () => enrollmentAction(user.id, "ENROLL"), variant: "primary", disabled: isBusy },
      { label: "Unenroll", onClick: () => enrollmentAction(user.id, "UNENROLL"), disabled: isBusy },
      { label: "Delete", onClick: () => requestDeleteUser(user), variant: "danger", disabled: isBusy || isAdmin },
    ];
  }

  return (
    <div className="space-y-6">
      {/* ── Add Participant ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Add Participant</h2>
        <p className="mt-1 text-xs text-slate-500">Add a user to an organization. They will be created as an Employee.</p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Organization</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={createForm.tenantId}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantId: e.target.value }))}
            >
              <option value="">Select organization</option>
              {orgTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

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
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search users…"
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
          >
            <option value="">All organizations</option>
            {orgTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={assessmentIdInput}
            onChange={(e) => setAssessmentIdInput(e.target.value)}
          >
            <option value="">Select assessment for actions</option>
            {assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title} {!assessment.isPublished && "(Draft)"}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={loadUsers}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
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
                  description="Try adjusting your search or add a participant above."
                  colSpan={4}
                />
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      {user.role === "ADMIN" && (
                        <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Admin</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{user.tenant?.name}</td>
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
                          {orgTenants.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                          onClick={() => moveUser(user.id)}
                          disabled={busyUserId === user.id || user.role === "ADMIN"}
                        >
                          Move
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Inspect Panel (Tests / Access) ── */}
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
              archives={(inspectPanel.data.reportArchiveHistory || []) as never[]}
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
        confirmLabel="Delete"
        variant={confirmState.variant}
        busy={confirmState.busy}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
