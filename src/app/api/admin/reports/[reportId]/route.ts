import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> },
) {
    const check = await requireAdmin();
    if ("error" in check) return check.error;

    const { reportId } = await params;
    const body = await req.json().catch(() => null);

    if (!body) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { narrativeJson, status, availableAt } = body;

    const updateData: Prisma.ReportUpdateInput = {};
    if (typeof narrativeJson === "string") updateData.narrativeJson = narrativeJson;
    if (status === "DRAFT" || status === "PUBLISHED") updateData.status = status;
    if (availableAt !== undefined) {
        updateData.availableAt = availableAt === null ? null : new Date(availableAt);
    }

    try {
        const report = await db.report.update({
            where: { id: reportId },
            data: updateData,
        });
        return NextResponse.json({ ok: true, report });
    } catch {
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
    }
}
