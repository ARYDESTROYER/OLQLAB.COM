import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { notFound } from "next/navigation";
import ReportEditorClient from "./ReportEditorClient";

export default async function AdminReportEditorPage({
    params,
}: {
    params: Promise<{ reportId: string }>;
}) {
    const check = await requireAdmin();
    if ("error" in check) return check.error;

    const { reportId } = await params;

    const report = await db.report.findUnique({
        where: { id: reportId },
        include: {
            user: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            assessment: {
                select: {
                    title: true,
                },
            },
        },
    });

    if (!report) {
        notFound();
    }

    return <ReportEditorClient report={report} />;
}
