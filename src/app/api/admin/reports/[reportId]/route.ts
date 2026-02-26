import { NextRequest, NextResponse } from "next/server";
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

    const updateData: any = {};
    if (narrativeJson !== undefined) updateData.narrativeJson = narrativeJson;
    if (status !== undefined) updateData.status = status;
    if (availableAt !== undefined) updateData.availableAt = availableAt === null ? null : new Date(availableAt);

    try {
        const report = await db.report.update({
            where: { id: reportId },
            data: updateData,
        });
        return NextResponse.json({ ok: true, report });
    } catch (err) {
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
    }
}
