"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/Toast";
import EmptyState from "@/components/admin/EmptyState";
import InspectPanel from "@/components/admin/InspectPanel";

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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busyTenantId, setBusyTenantId] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    seatLimit: 50,
  });

  const [editByTenant, setEditByTenant] = useState<
    Record<string, { name: string; seatLimit: number; isArchived: boolean }>
  >({});

  // Inspect panel state
  const [inspectPanel, setInspectPanel] = useState<{
    open: boolean;
    title: string;
    data: unknown[] | null;
    loading: boolean;
  }>({ open: false, title: "", data: null, loading: false });

  const loadTenants = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (includeArchived) params.set("includeArchived", "1");

    const res = await fetch(`/api/admin/tenants?${params.toString()}`);
    const data = await res.json();
    // Filter: only show ORGANIZATION tenants in the UI
    const rows = (data.tenants || []).filter((t: Tenant) => t.type === "ORGANIZATION");
    setTenants(rows);

    setEditByTenant((prev) => {
      const next = { ...prev };
      for (const tenant of rows) {
        if (!next[tenant.id]) {
          next[tenant.id] = {
            name: tenant.name,
            seatLimit: tenant.seatLimit,
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
      toast("Organization name is required.", "error");
      return;
    }

    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name,
        type: "ORGANIZATION",
        seatLimit: createForm.seatLimit,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      toast(`Organization "${createForm.name}" created.`, "success");
      setCreateForm({ name: "", seatLimit: 50 });
      await loadTenants();
    } else {
      toast(data.error || "Failed to create organization.", "error");
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
        toast("Organization updated.", "success");
        await loadTenants();
      } else {
        toast(data.error || "Failed to update organization.", "error");
      }
    } finally {
      setBusyTenantId("");
    }
  }

  async function inspect(tenant: Tenant, type: "users" | "access") {
    setInspectPanel({
      open: true,
      title: `${tenant.name} — ${type === "users" ? "Users" : "Access"}`,
      data: null,
      loading: true,
    });

    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/${type}`);
      const data = await res.json();
      setInspectPanel((prev) => ({
        ...prev,
        data: type === "users" ? data.users || [] : data.access || data.enrollments || [],
        loading: false,
      }));
    } catch {
      toast("Failed to load data.", "error");
      setInspectPanel((prev) => ({ ...prev, loading: false }));
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Create Organization ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Organization</h2>
        <p className="mt-1 text-xs text-slate-500">Add a new client organization to the platform.</p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Organization name"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="w-28">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Seats</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={createForm.seatLimit}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, seatLimit: Number(e.target.value) }))
              }
            />
          </div>

          <button
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            onClick={createTenant}
          >
            Create
          </button>
        </div>
      </section>

      {/* ── Organization Directory ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search organizations…"
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
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={loadTenants}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Seat Limit</th>
                <th className="px-3 py-2">Archived</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <EmptyState
                  icon="🏢"
                  title="No organizations found"
                  description="Create a new organization or adjust your search."
                  colSpan={4}
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
                      <p className="mt-1 text-[11px] text-slate-400">{tenant.id}</p>
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
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                          onClick={() => inspect(tenant, "users")}
                        >
                          Users
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                          onClick={() => inspect(tenant, "access")}
                        >
                          Access
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800 transition-colors"
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
        ) : inspectPanel.data && Array.isArray(inspectPanel.data) ? (
          inspectPanel.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data found.</p>
          ) : (
            <pre className="overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{JSON.stringify(inspectPanel.data, null, 2)}</pre>
          )
        ) : null}
      </InspectPanel>
    </div>
  );
}
