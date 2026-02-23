"use client";

import { FormEvent, useState } from "react";

type Json = Record<string, unknown> | Array<unknown>;

export default function AdminPage() {
  const [tenantResp, setTenantResp] = useState<Json | null>(null);
  const [importResp, setImportResp] = useState<Json | null>(null);
  const [assessmentResp, setAssessmentResp] = useState<Json | null>(null);
  const [inviteResp, setInviteResp] = useState<Json | null>(null);
  const [publishResp, setPublishResp] = useState<Json | null>(null);

  async function createTenant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), seatLimit: Number(fd.get("seatLimit")) }),
    });
    setTenantResp(await res.json());
  }

  async function importCsv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/users/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: fd.get("tenantId"), csvText: fd.get("csvText") }),
    });
    setImportResp(await res.json());
  }

  async function createAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const questions = String(fd.get("questions"))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [trait, prompt] = line.split("|");
        return { trait: trait.trim(), prompt: prompt.trim(), reverse: false };
      });

    const res = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: fd.get("tenantId"), title: fd.get("title"), questions }),
    });
    setAssessmentResp(await res.json());
  }

  async function sendInvites(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: fd.get("tenantId") }),
    });
    setInviteResp(await res.json());
  }

  async function publishAssessment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const assessmentId = String(fd.get("assessmentId"));
    const res = await fetch(`/api/admin/assessments/${assessmentId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPublished: fd.get("isPublished") === "on",
        showResultsToEmployee: fd.get("showResultsToEmployee") === "on",
        resultReleaseDelayHours: Number(fd.get("resultReleaseDelayHours")),
        postSubmitMessage: fd.get("postSubmitMessage"),
        leaderCanViewFullReport: fd.get("leaderCanViewFullReport") === "on",
      }),
    });
    setPublishResp(await res.json());
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Admin Console</h1>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">1) Create Tenant</h2>
        <form className="mt-3 grid gap-2" onSubmit={createTenant}>
          <input className="rounded border px-3 py-2" name="name" placeholder="Company name" required />
          <input className="rounded border px-3 py-2" name="seatLimit" type="number" placeholder="Seat limit" required />
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Create</button>
        </form>
        {tenantResp && <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(tenantResp, null, 2)}</pre>}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">2) Import Employees CSV</h2>
        <form className="mt-3 grid gap-2" onSubmit={importCsv}>
          <input className="rounded border px-3 py-2" name="tenantId" placeholder="tenantId" required />
          <textarea
            className="h-40 rounded border px-3 py-2 font-mono text-xs"
            name="csvText"
            required
            placeholder={"email,first_name,last_name,manager_email\njane@acme.com,Jane,Doe,boss@acme.com"}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Import CSV</button>
        </form>
        {importResp && <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(importResp, null, 2)}</pre>}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">3) Create Assessment</h2>
        <form className="mt-3 grid gap-2" onSubmit={createAssessment}>
          <input className="rounded border px-3 py-2" name="tenantId" placeholder="tenantId" required />
          <input className="rounded border px-3 py-2" name="title" placeholder="Assessment title" required />
          <textarea
            className="h-40 rounded border px-3 py-2 font-mono text-xs"
            name="questions"
            required
            placeholder={"openness|I enjoy trying new approaches at work.\nconscientiousness|I carefully plan my work before executing."}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Create Assessment</button>
        </form>
        {assessmentResp && <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(assessmentResp, null, 2)}</pre>}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">4) Send Invites</h2>
        <form className="mt-3 grid gap-2" onSubmit={sendInvites}>
          <input className="rounded border px-3 py-2" name="tenantId" placeholder="tenantId" required />
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Send invites</button>
        </form>
        {inviteResp && <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(inviteResp, null, 2)}</pre>}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">5) Publish & Policy</h2>
        <form className="mt-3 grid gap-2" onSubmit={publishAssessment}>
          <input className="rounded border px-3 py-2" name="assessmentId" placeholder="assessmentId" required />
          <label><input type="checkbox" name="isPublished" defaultChecked /> isPublished</label>
          <label><input type="checkbox" name="showResultsToEmployee" defaultChecked /> showResultsToEmployee</label>
          <input className="rounded border px-3 py-2" name="resultReleaseDelayHours" type="number" defaultValue={0} />
          <input className="rounded border px-3 py-2" name="postSubmitMessage" defaultValue="Thank you. Your results are being prepared." />
          <label><input type="checkbox" name="leaderCanViewFullReport" defaultChecked /> leaderCanViewFullReport</label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Save policy</button>
        </form>
        {publishResp && <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(publishResp, null, 2)}</pre>}
      </section>
    </main>
  );
}
