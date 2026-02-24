"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  type: "ORGANIZATION" | "SOLO";
  seatLimit: number;
  isArchived: boolean;
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assessmentIdInput, setAssessmentIdInput] = useState("");
  const [output, setOutput] = useState("");
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

  const tenantOptions = useMemo(() => tenants.filter((item) => !item.isArchived), [tenants]);

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

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 200);

    return () => clearTimeout(timer);
  }, [loadUsers]);

  async function createUser() {
    if (!createForm.tenantId || !createForm.email.trim()) {
      setOutput("Tenant and email are required.");
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
    setOutput(JSON.stringify(data, null, 2));
    if (res.ok) {
      setCreateForm((prev) => ({
        ...prev,
        email: "",
        firstName: "",
        lastName: "",
        managerEmail: "",
      }));
      await loadUsers();
    }
  }

  async function deleteUser(userId: string) {
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
      if (res.ok) await loadUsers();
    } finally {
      setBusyUserId("");
    }
  }

  async function moveUser(userId: string) {
    const targetTenantId = moveTenantByUser[userId];
    if (!targetTenantId) {
      setOutput("Select a target tenant first.");
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
      setOutput(JSON.stringify(data, null, 2));
      if (res.ok) await loadUsers();
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
      setOutput(JSON.stringify(data, null, 2));
      if (res.ok) {
        await Promise.all([loadUsers(), loadTenants()]);
      }
    } finally {
      setBusyUserId("");
    }
  }

  async function inspect(userId: string, type: "tests" | "access") {
    const res = await fetch(`/api/admin/users/${userId}/${type}`);
    const data = await res.json();
    setOutput(JSON.stringify(data, null, 2));
  }

  async function enrollmentAction(userId: string, action: "ENROLL" | "UNENROLL") {
    if (!assessmentIdInput.trim()) {
      setOutput("Assessment ID is required for enrollment action.");
      return;
    }

    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: assessmentIdInput.trim(),
          action,
          reportMode: "KEEP_APP_ACCESS",
          notifyByEmail: false,
        }),
      });
      const data = await res.json();
      setOutput(JSON.stringify(data, null, 2));
      await loadUsers();
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <div className="space-y-6">
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Assessment ID for row actions"
            value={assessmentIdInput}
            onChange={(e) => setAssessmentIdInput(e.target.value)}
          />
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
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2">{user.tenant?.name}</td>
                  <td className="px-3 py-2">{user.manager?.email || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                        onClick={() => inspect(user.id, "tests")}
                      >
                        Tests
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                        onClick={() => inspect(user.id, "access")}
                      >
                        Access
                      </button>
                      <button
                        className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px]"
                        onClick={() => enrollmentAction(user.id, "ENROLL")}
                        disabled={busyUserId === user.id}
                      >
                        Enroll
                      </button>
                      <button
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px]"
                        onClick={() => enrollmentAction(user.id, "UNENROLL")}
                        disabled={busyUserId === user.id}
                      >
                        Unenroll
                      </button>
                      <button
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px]"
                        onClick={() => convertToSolo(user.id)}
                        disabled={busyUserId === user.id || user.role === "ADMIN"}
                      >
                        Solo
                      </button>
                      <button
                        className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px]"
                        onClick={() => deleteUser(user.id)}
                        disabled={busyUserId === user.id || user.role === "ADMIN"}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {output && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold">Output</h3>
          <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{output}</pre>
        </section>
      )}
    </div>
  );
}
