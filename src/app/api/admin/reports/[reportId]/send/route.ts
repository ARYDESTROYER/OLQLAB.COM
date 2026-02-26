import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { issueReportShareToken } from "@/lib/unenroll-jobs";
import { getEnv } from "@/lib/env";
import { getResend } from "@/lib/resend";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    const check = await requireAdmin();
    if ("error" in check) return check.error;

    const { reportId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || !body.deliveryMethod) {
        return NextResponse.json({ error: "Invalid body. deliveryMethod strictly required." }, { status: 400 });
    }

    const { narrativeJson, deliveryMethod } = body;

    const report = await db.report.findUnique({
        where: { id: reportId },
        include: {
            user: true,
            assessment: true,
        }
    });

    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const updateData: any = {
        status: "PUBLISHED",
        availableAt: new Date(),
        deliveryMethod,
    };

    if (narrativeJson) {
        updateData.narrativeJson = narrativeJson;
    }

    const updated = await db.report.update({
        where: { id: reportId },
        data: updateData
    });

    if (deliveryMethod === "EMAIL_LINK") {
        const tokenData = await issueReportShareToken({
            assessmentId: report.assessmentId,
            userId: report.userId,
            ttlHours: 168, // 1 week
        });

        if (tokenData) {
            const resend = getResend();
            const env = getEnv();
            const baseUrl = env.REPORT_SHARE_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";
            const reportUrl = `${baseUrl}/reports/shared/${encodeURIComponent(tokenData.token)}`;
            const pdfUrl = `${baseUrl}/api/reports/shared/${encodeURIComponent(tokenData.token)}/pdf`;

            try {
                await resend.emails.send({
                    from: env.EMAIL_FROM,
                    to: report.user.email,
                    subject: `Your assessment report is ready: ${report.assessment.title}`,
                    html: `<p>Hi ${report.user.firstName},</p>
<p>Your report for <strong>${report.assessment.title}</strong> has been published and is now available.</p>
<p><a href="${reportUrl}">View your report online</a></p>
<p><a href="${pdfUrl}">Download PDF version</a></p>
<p>This secure link will expire in 7 days. No sign-in is required to view your report.</p>`
                });
            } catch (e) {
                console.error("Failed to send report email:", e);
            }
        }
    }

    return NextResponse.json({ ok: true, report: updated });
}
