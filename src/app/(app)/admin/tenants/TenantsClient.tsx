"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/admin/Toast";
import EmptyState from "@/components/admin/EmptyState";
import InspectPanel from "@/components/admin/InspectPanel";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type Tenant = {
  id: string;
  name: string;
  type: "ORGANIZATION" | "SOLO";
  seatLimit: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  seatsUsed?: number;
  usersCount?: number;
  seatUtilization?: number;
  seatState?: "HAS_ROOM" | "AT_CAPACITY" | "OVER_CAPACITY";
};

type TenantListMeta = {
  returned: number;
  limit: number;
  totalMatchingFilters: number | null;
  totalCandidates: number;
  hasMore: boolean;
  truncated: boolean;
};

export default function TenantsClient() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q")?.trim() || "";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const tenantRequestRef = useRef<AbortController | null>(null);
  const [listMeta, setListMeta] = useState<TenantListMeta>({
    returned: 0,
    limit: 100,
    totalMatchingFilters: 0,
    totalCandidates: 0,
    hasMore: false,
    truncated: false,
  });
  const [listLimit, setListLimit] = useState(100);
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | "ORGANIZATION" | "SOLO">("ORGANIZATION");
  const [seatStateFilter, setSeatStateFilter] = useState<
    "" | "HAS_ROOM" | "AT_CAPACITY" | "OVER_CAPACITY"
  >("");
  const [sortBy, setSortBy] = useState<
    "updatedAt" | "createdAt" | "name" | "seatLimit" | "seatsUsed" | "seatUtilization"
  >("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [busyTenantId, setBusyTenantId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [archiveConfirm, setArchiveConfirm] = useState({
    open: false,
    targetArchived: false,
    busy: false,
  });

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
    tenantRequestRef.current?.abort();
    const controller = new AbortController();
    tenantRequestRef.current = controller;
    setListLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (includeArchived) params.set("includeArchived", "1");
    if (typeFilter) params.set("type", typeFilter);
    if (seatStateFilter) params.set("seatState", seatStateFilter);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("limit", String(listLimit));

    try {
      const res = await fetch(`/api/admin/tenants?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load organisations.");
      }
      if (tenantRequestRef.current !== controller) return;
      const rows = (data as { tenants?: Tenant[] }).tenants || [];
      setTenants(rows);
      setListMeta(
        (data as { meta?: TenantListMeta }).meta || {
          returned: rows.length,
          limit: 100,
          totalMatchingFilters: rows.length,
          totalCandidates: rows.length,
          hasMore: false,
          truncated: false,
        },
      );
      setSelectedTenantIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));

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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast(error instanceof Error ? error.message : "Failed to load organisations.", "error");
    } finally {
      if (tenantRequestRef.current === controller && !controller.signal.aborted) {
        setListLoading(false);
      }
    }
  }, [includeArchived, listLimit, query, seatStateFilter, sortBy, sortOrder, typeFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadTenants(),
      query.trim() ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timeout);
      tenantRequestRef.current?.abort();
    };
  }, [loadTenants, query]);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  function resetFilters() {
    setQuery("");
    setIncludeArchived(false);
    setTypeFilter("ORGANIZATION");
    setSeatStateFilter("");
    setSortBy("updatedAt");
    setSortOrder("desc");
  }

  async function createTenant() {
    if (!createForm.name.trim()) {
      toast("Organisation name is required.", "error");
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
      toast(`Organisation "${createForm.name}" created.`, "success");
      setCreateForm({ name: "", seatLimit: 50 });
      await loadTenants();
    } else {
      toast(data.error || "Failed to create organisation.", "error");
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
        toast("Organisation updated.", "success");
        await loadTenants();
      } else {
        toast(data.error || "Failed to update organisation.", "error");
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

  function getRowActions(tenant: Tenant): ActionItem[] {
    return [
      { label: "Users", onClick: () => inspect(tenant, "users"), disabled: bulkBusy },
      { label: "Access", onClick: () => inspect(tenant, "access"), disabled: bulkBusy },
    ];
  }

  async function exportTenantsCsv() {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (includeArchived) params.set("includeArchived", "1");
      if (typeFilter) params.set("type", typeFilter);
      if (seatStateFilter) params.set("seatState", seatStateFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("format", "csv");
      params.set("limit", "5000");

      const res = await fetch(`/api/admin/tenants?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || "Failed to export CSV.", "error");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-organisations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("CSV export started.", "success");
    } catch {
      toast("Failed to export CSV.", "error");
    }
  }

  const allSelected = tenants.length > 0 && selectedTenantIds.length === tenants.length;

  function toggleAllTenants(checked: boolean) {
    if (!checked) {
      setSelectedTenantIds([]);
      return;
    }
    setSelectedTenantIds(tenants.map((tenant) => tenant.id));
  }

  function toggleTenantSelection(tenantId: string, checked: boolean) {
    setSelectedTenantIds((prev) => {
      if (checked) return Array.from(new Set([...prev, tenantId]));
      return prev.filter((id) => id !== tenantId);
    });
  }

  function runBulkArchive(targetArchived: boolean) {
    if (selectedTenantIds.length === 0) {
      toast("Select at least one organisation.", "error");
      return;
    }

    setArchiveConfirm({ open: true, targetArchived, busy: false });
  }

  async function executeBulkArchive(targetArchived: boolean) {
    setBulkBusy(true);
    let successCount = 0;
    let failCount = 0;

    for (const tenantId of selectedTenantIds) {
      const tenant = tenants.find((item) => item.id === tenantId);
      if (!tenant) continue;

      const payload = editByTenant[tenantId] || {
        name: tenant.name,
        seatLimit: tenant.seatLimit,
        isArchived: tenant.isArchived,
      };

      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          isArchived: targetArchived,
        }),
      });

      if (res.ok) {
        successCount += 1;
      } else {
        failCount += 1;
      }
    }

    setBulkBusy(false);
    setSelectedTenantIds([]);
    await loadTenants();

    if (failCount === 0) {
      toast(
        `${targetArchived ? "Archive" : "Unarchive"} complete: ${successCount} updated.`,
        "success",
      );
      return;
    }

    toast(
      `${targetArchived ? "Archive" : "Unarchive"} complete: ${successCount} updated, ${failCount} failed.`,
      "error",
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Create Organisation ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Organisation</h2>
        <p className="mt-1 text-xs text-slate-500">Add a new client organisation to the platform.</p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Organisation name"
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

      {/* ── Organisation Directory ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organisations…"
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as "" | "ORGANIZATION" | "SOLO")
            }
          >
            <option value="">All organisation types</option>
            <option value="ORGANIZATION">Organisations</option>
            <option value="SOLO">Solo organisations</option>
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={seatStateFilter}
            onChange={(e) =>
              setSeatStateFilter(
                e.target.value as "" | "HAS_ROOM" | "AT_CAPACITY" | "OVER_CAPACITY",
              )
            }
          >
            <option value="">Capacity: Any</option>
            <option value="HAS_ROOM">Has room</option>
            <option value="AT_CAPACITY">At capacity</option>
            <option value="OVER_CAPACITY">Over capacity</option>
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "updatedAt"
                  | "createdAt"
                  | "name"
                  | "seatLimit"
                  | "seatsUsed"
                  | "seatUtilization",
              )
            }
          >
            <option value="updatedAt">Sort: Updated</option>
            <option value="createdAt">Sort: Created</option>
            <option value="name">Sort: Name</option>
            <option value="seatLimit">Sort: Seat limit</option>
            <option value="seatsUsed">Sort: Seats used</option>
            <option value="seatUtilization">Sort: Utilization</option>
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
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
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={resetFilters}
          >
            Clear Filters
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            onClick={exportTenantsCsv}
          >
            Export CSV
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {listMeta.totalMatchingFilters === null
            ? `Showing ${tenants.length} organisation(s) from a bounded window of ${listMeta.totalCandidates} candidates.`
            : `Showing ${tenants.length} of ${listMeta.totalMatchingFilters} matching organisation(s).`}
        </p>
        {listMeta.hasMore ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>This list does not cover every matching record. CSV export will refuse an incomplete file.</p>
            {listMeta.limit < 500 ? (
              <button
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-100"
                onClick={() => setListLimit((current) => Math.min(500, current + 100))}
              >
                Load 100 more
              </button>
            ) : (
              <span className="font-medium">Narrow the filters to inspect the remaining records.</span>
            )}
          </div>
        ) : null}

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          {selectedTenantIds.length > 0 && (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {selectedTenantIds.length} selected
                </span>
                <button
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  onClick={() => runBulkArchive(true)}
                  disabled={bulkBusy}
                >
                  Archive Selected
                </button>
                <button
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  onClick={() => runBulkArchive(false)}
                  disabled={bulkBusy}
                >
                  Unarchive Selected
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                  onClick={() => setSelectedTenantIds([])}
                  disabled={bulkBusy}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
          <table className="min-w-full text-left text-sm" aria-busy={listLoading}>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAllTenants(e.target.checked)}
                    aria-label="Select all organisations"
                  />
                </th>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Seat Limit</th>
                <th className="px-3 py-2">Usage</th>
                <th className="px-3 py-2">Archived</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && tenants.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                    Loading organisations…
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <EmptyState
                  icon="🏢"
                  title="No organisations found"
                  description="Create a new organisation or adjust your search."
                  colSpan={7}
                />
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTenantIds.includes(tenant.id)}
                        onChange={(e) => toggleTenantSelection(tenant.id, e.target.checked)}
                        disabled={bulkBusy}
                        aria-label={`Select ${tenant.name}`}
                      />
                    </td>
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
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {tenant.type}
                      </span>
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
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div className="font-medium">
                        {tenant.seatsUsed ?? 0}/{tenant.seatLimit}
                      </div>
                      <div>
                        {tenant.seatUtilization ?? 0}% ·{" "}
                        {tenant.seatState
                          ? tenant.seatState.replaceAll("_", " ")
                          : "HAS ROOM"}
                      </div>
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
                        <ActionMenu actions={getRowActions(tenant)} />
                        <button
                          className="rounded-lg border border-slate-300 bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800 transition-colors"
                          onClick={() => saveTenant(tenant.id)}
                          disabled={busyTenantId === tenant.id || bulkBusy}
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

      <ConfirmDialog
        open={archiveConfirm.open}
        title={`${archiveConfirm.targetArchived ? "Archive" : "Unarchive"} Organisations`}
        message={`${archiveConfirm.targetArchived ? "Archive" : "Unarchive"} ${selectedTenantIds.length} selected organisations?`}
        confirmLabel={archiveConfirm.targetArchived ? "Archive" : "Unarchive"}
        variant={archiveConfirm.targetArchived ? "danger" : "default"}
        busy={archiveConfirm.busy}
        onConfirm={() => {
          const targetArchived = archiveConfirm.targetArchived;
          setArchiveConfirm((prev) => ({ ...prev, busy: true }));
          void executeBulkArchive(targetArchived).finally(() => {
            setArchiveConfirm({ open: false, targetArchived: false, busy: false });
          });
        }}
        onCancel={() =>
          setArchiveConfirm({ open: false, targetArchived: false, busy: false })
        }
      />
    </div>
  );
}
