"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/Toast";
import EmptyState from "@/components/admin/EmptyState";

type Tenant = {
  id: string;
  name: string;
  type: "ORGANIZATION" | "SOLO";
  seatLimit: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function TenantsClient() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(true);
  const [busyTenantId, setBusyTenantId] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    type: "ORGANIZATION" as "ORGANIZATION" | "SOLO",
    seatLimit: 50,
  });

  const [editByTenant, setEditByTenant] = useState<
    Record<string, { name: string; seatLimit: number; type: "ORGANIZATION" | "SOLO"; isArchived: boolean }>
  >({});

  const loadTenants = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (includeArchived) params.set("includeArchived", "1");

    const res = await fetch(`/api/admin/tenants?${params.toString()}`);
    const data = await res.json();
    const rows = data.tenants || [];
    setTenants(rows);

    setEditByTenant((prev) => {
      const next = { ...prev };
      for (const tenant of rows) {
        if (!next[tenant.id]) {
          next[tenant.id] = {
            name: tenant.name,
            seatLimit: tenant.seatLimit,
            type: tenant.type,
            isArchived: tenant.isArchived,
          };
        }
      }
      return next;
    });
  }, [includeArchived, query]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") loadTenants();
  }

  async function createTenant() {
    if (!createForm.name.trim()) {
      toast("Tenant name is required.", "error");
      return;
    }

    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();

    if (res.ok) {
      toast(`Tenant "${createForm.name}" created.`, "success");
      setCreateForm({ name: "", type: "ORGANIZATION", seatLimit: 50 });
      await loadTenants();
    } else {
      toast(data.error || "Failed to create tenant.", "error");
    }
  }

  async function saveTenant(tenantId: string) {
    const payload = editByTenant[tenantId];
    if (!payload) return;

    setBusyTenantId(tenantId);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Tenant updated.", "success");
        await loadTenants();
      } else {
        toast(data.error || "Failed to update tenant.", "error");
      }
    } finally {
      setBusyTenantId("");
    }
  }

  async function inspect(tenantId: string, type: "users" | "access") {
    const res = await fetch(`/api/admin/tenants/${tenantId}/${type}`);
    const data = await res.json();
    toast(`${type === "users" ? "Users" : "Access"} data loaded — check console.`, "info");
    console.log(`[Admin] Tenant ${tenantId} ${type}:`, data);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Tenant</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tenant name"
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createForm.type}
            onChange={(e) =>
              setCreateForm((prev) => ({
                ...prev,
                type: e.target.value as "ORGANIZATION" | "SOLO",
              }))
            }
          >
            <option value="ORGANIZATION">ORGANIZATION</option>
            <option value="SOLO">SOLO</option>
          </select>
          <input
            type="number"
            min={1}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={createForm.seatLimit}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, seatLimit: Number(e.target.value) }))
            }
          />
        </div>
        <button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={createTenant}>
          Create Tenant
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search tenants"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived
          </label>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            onClick={loadTenants}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Seat Limit</th>
                <th className="px-3 py-2">Archived</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <EmptyState
                  icon="🏢"
                  title="No tenants found"
                  description="Try adjusting your search or create a new tenant."
                />
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={editByTenant[tenant.id]?.name || tenant.name}
                        onChange={(e) =>
                          setEditByTenant((prev) => ({
                            ...prev,
                            [tenant.id]: {
                              ...prev[tenant.id],
                              name: e.target.value,
                            },
                          }))
                        }
                      />
                      <p className="mt-1 text-[11px] text-slate-500">{tenant.id}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={editByTenant[tenant.id]?.type || tenant.type}
                        onChange={(e) =>
                          setEditByTenant((prev) => ({
                            ...prev,
                            [tenant.id]: {
                              ...prev[tenant.id],
                              type: e.target.value as "ORGANIZATION" | "SOLO",
                            },
                          }))
                        }
                      >
                        <option value="ORGANIZATION">ORGANIZATION</option>
                        <option value="SOLO">SOLO</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={editByTenant[tenant.id]?.seatLimit || tenant.seatLimit}
                        onChange={(e) =>
                          setEditByTenant((prev) => ({
                            ...prev,
                            [tenant.id]: {
                              ...prev[tenant.id],
                              seatLimit: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={editByTenant[tenant.id]?.isArchived || false}
                          onChange={(e) =>
                            setEditByTenant((prev) => ({
                              ...prev,
                              [tenant.id]: {
                                ...prev[tenant.id],
                                isArchived: e.target.checked,
                              },
                            }))
                          }
                        />
                        Archived
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                          onClick={() => inspect(tenant.id, "users")}
                        >
                          Users
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                          onClick={() => inspect(tenant.id, "access")}
                        >
                          Access
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 bg-slate-900 px-2.5 py-1 text-[11px] text-white"
                          onClick={() => saveTenant(tenant.id)}
                          disabled={busyTenantId === tenant.id}
                        >
                          {busyTenantId === tenant.id ? "Saving…" : "Save"}
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
    </div>
  );
}
