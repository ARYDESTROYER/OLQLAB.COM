import { db } from "@/lib/db";
import { lookupReportShareToken } from "@/lib/unenroll-jobs";
import Image from "next/image";

function resolveSharedNarrativeHtml(narrative: Record<string, unknown> | null) {
  if (!narrative) return "";

  const adminEditedHtml = narrative.adminEditedHtml;
  if (typeof adminEditedHtml === "string" && adminEditedHtml.trim()) {
    return adminEditedHtml;
  }

  const aiNarrative = narrative.aiNarrative;
  if (typeof aiNarrative === "string" && aiNarrative.trim()) {
    return aiNarrative;
  }

  if (aiNarrative && typeof aiNarrative === "object") {
    const ai = aiNarrative as {
      executiveSummary?: string;
      strengthsNarrative?: string;
      developmentNarrative?: string;
      managerCoaching?: string;
    };

    const blocks = [
      ai.executiveSummary,
      ai.strengthsNarrative,
      ai.developmentNarrative,
      ai.managerCoaching,
    ].filter((item): item is string => Boolean(item && item.trim()));

    if (blocks.length) {
      return blocks.map((block) => `<p>${block}</p>`).join("");
    }
  }

  return "";
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenRow = await lookupReportShareToken(token);

  if (!tokenRow) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#F4EEE0] p-8 rounded-xl shadow border border-gray-200 text-center">
          <div className="w-16 h-16 bg-[#F4EEE0] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#101114]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h1>
          <p className="text-gray-500 mb-6">This secure report link has expired, been revoked, or reached its maximum download limit.</p>
        </div>
      </div>
    );
  }

  const report = await db.report.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId: tokenRow.assessmentId,
        userId: tokenRow.userId,
      },
    },
    include: {
      assessment: {
        select: {
          policy: {
            select: {
              reportWorkflow: true,
            },
          },
        },
      },
      pdfAsset: {
        select: {
          id: true,
          fileName: true,
        },
      },
    },
  });

  const isManualWorkflow = report?.assessment.policy?.reportWorkflow === "MANUAL_PDF_UPLOAD";
  const narrative = report ? (JSON.parse(report.narrativeJson) as Record<string, unknown>) : null;
  const renderedHtml = resolveSharedNarrativeHtml(narrative);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#F4EEE0] border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-full" />
            <div>
              <h1 className="text-sm md:text-base font-bold text-gray-900 leading-tight truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                {tokenRow.assessment.title}
              </h1>
              <p className="text-xs text-gray-500">
                Prepared for {tokenRow.user.firstName} {tokenRow.user.lastName}
              </p>
            </div>
          </div>
          <a
            href={`/api/reports/shared/${token}/pdf`}
            download
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#101114] hover:bg-[#1b1c20] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="mr-2 -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-24">
        <div className="bg-[#F4EEE0] shadow-sm rounded-xl border border-gray-200 overflow-hidden relative min-h-[800px]">
          <div className="p-8 md:p-16 lg:px-24 prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-900">
            {isManualWorkflow ? (
              <div className="not-prose rounded-2xl border border-[#101114]/12 bg-[#F4EEE0]/60 p-6 text-center">
                <h2 className="text-xl font-semibold text-[#101114]">Manual PDF Report</h2>
                <p className="mt-2 text-sm text-[#101114]/72">
                  This report is delivered as a PDF document. Use the download button to access the full report.
                </p>
                {report?.pdfAsset?.fileName ? (
                  <p className="mt-2 text-xs text-[#101114]/55">File: {report.pdfAsset.fileName}</p>
                ) : null}
              </div>
            ) : renderedHtml ? (
              <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg">Report content is not available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
