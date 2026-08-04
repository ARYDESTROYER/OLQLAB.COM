import { db } from "@/lib/db";
import { getLiveAdminSession } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import ReportEditorClient from "./ReportEditorClient";

export default async function AdminReportEditorPage({
    params,
}: {
    params: Promise<{ reportId: string }>;
}) {
    const check = await getLiveAdminSession();
    if (!check) redirect("/dashboard");

    const { reportId } = await params;

    const report = await db.report.findUnique({
        where: { id: reportId },
        include: {
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

    const user = await db.user.findUnique({
        where: { id: report.userId },
        select: {
            firstName: true,
            lastName: true,
            email: true,
        },
    });

    if (!user) {
        notFound();
    }

    return <ReportEditorClient report={{ ...report, user }} />;
}
