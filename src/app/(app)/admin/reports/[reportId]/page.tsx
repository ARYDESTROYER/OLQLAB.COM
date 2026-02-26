import { db } from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import ReportEditorClient from "./ReportEditorClient";

export default async function AdminReportEditorPage({
    params,
}: {
    params: Promise<{ reportId: string }>;
}) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) redirect("/signin");
    if (session.user.role !== "ADMIN") redirect("/dashboard");

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
