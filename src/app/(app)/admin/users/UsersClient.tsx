"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";

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

  const [createForm, setCreateForm] = useState({
    tenantId: "",
    email: "",
    firstName: "",
    lastName: "",
    role: "EMPLOYEE" as "EMPLOYEE" | "LEADER",
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

  const tenantOptions = useMemo(() => tenants.filter((item) => !item.isArchived), [tenants]);

  // ----- Data loaders -----

  const loadTenants = useCallback(async () => {
    const res = await fetch("/api/admin/tenants?includeArchived=1");
    const data = await res.json();
    setTenants(data.tenants || []);
    setCreateForm((prev) => {
      if (prev.tenantId || !data.tenants?.[0]?.id) return prev;
      return { ...prev, tenantId: data.tenants[0].id };
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
      toast("Tenant and email are required.", "error");
      return;
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: createForm.tenantId,
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        role: createForm.role,
        managerEmail: createForm.managerEmail || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      toast(`User ${data.user?.email || createForm.email} created.`, "success");
      setCreateForm((prev) => ({
        ...prev,
        email: "",
        firstName: "",
        lastName: "",
        managerEmail: "",
      }));
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
      toast("Select a target tenant first.", "error");
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
        toast("User moved to new tenant.", "success");
        await loadUsers();
      } else {
        toast(data.error || "Failed to move user.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  async function convertToSolo(userId: string) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convertToSolo: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Converted to solo tenant.", "success");
        await Promise.all([loadUsers(), loadTenants()]);
      } else {
        toast(data.error || "Failed to convert to solo.", "error");
      }
    } finally {
      setBusyUserId("");
    }
  }

  async function inspect(userId: string, type: "tests" | "access") {
    const res = await fetch(`/api/admin/users/${userId}/${type}`);
    const data = await res.json();
    toast(`${type === "tests" ? "Tests" : "Access"} data loaded — check console.`, "info");
    console.log(`[Admin] User ${userId} ${type}:`, data);
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
      { label: "View Tests", onClick: () => inspect(user.id, "tests") },
      { label: "View Access", onClick: () => inspect(user.id, "access") },
      { label: "Enroll", onClick: () => enrollmentAction(user.id, "ENROLL"), variant: "primary", disabled: isBusy },
      { label: "Unenroll", onClick: () => enrollmentAction(user.id, "UNENROLL"), disabled: isBusy },
      { label: "Convert to Solo", onClick: () => convertToSolo(user.id), disabled: isBusy || isAdmin },
      { label: "Delete", onClick: () => requestDeleteUser(user), variant: "danger", disabled: isBusy || isAdmin },
    ];
  }

  return (
    <div className="space-y-6">
      {/* Create User */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create User</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createForm.tenantId}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantId: e.target.value }))}
          >
            <option value="">Select tenant</option>
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.type})
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createForm.role}
            onChange={(e) =>
              setCreateForm((prev) => ({
                ...prev,
                role: e.target.value as "EMPLOYEE" | "LEADER",
              }))
            }
          >
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="LEADER">LEADER</option>
          </select>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="first name"
            value={createForm.firstName}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="last name"
            value={createForm.lastName}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="manager email (optional)"
            value={createForm.managerEmail}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, managerEmail: e.target.value }))}
          />
        </div>
        <button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={createUser}>
          Create User
        </button>
      </section>

      {/* Users Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search users"
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
          >
            <option value="">All tenants</option>
            {tenants.map((tenant) => (
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
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
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
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Manager</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <EmptyState
                  icon="👤"
                  title="No users found"
                  description="Try adjusting your search or filters."
                />
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.tenant?.name}</td>
                    <td className="px-3 py-2">{user.manager?.email || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ActionMenu actions={getRowActions(user)} />

                        <select
                          className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                          value={moveTenantByUser[user.id] || ""}
                          onChange={(e) =>
                            setMoveTenantByUser((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                        >
                          <option value="">Move to tenant</option>
                          {tenantOptions.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
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
